"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildDoctorReviewFormSnapshot,
  buildDoctorReviewLink,
  collectDoctorReviewSubmission,
  DOCTOR_REVIEW_LINK_TTL_HOURS,
  generateDoctorReviewToken,
  getRequestBaseUrl,
  hashDoctorReviewToken,
  isDoctorReviewExpired,
} from "@/lib/doctor-review";
import { sendPushNotifications } from "@/lib/push-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DoctorReviewSessionRow,
  RequestRow,
} from "@/lib/types";

export interface DoctorReviewLinkActionState {
  error: string;
  reviewUrl: string;
  expiresAt: string;
}

async function getOwnedOpsRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profile?.role !== "ops") {
    return null;
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id,created_by,doctor_name,form_data,status")
    .eq("id", requestId)
    .maybeSingle<Pick<RequestRow, "id" | "created_by" | "doctor_name" | "form_data" | "status">>();

  if (!request || request.created_by !== user.id || request.status !== "draft") {
    return null;
  }

  return { userId: user.id, request };
}

export async function generateDoctorReviewLinkAction(
  _previousState: DoctorReviewLinkActionState,
  formData: FormData,
): Promise<DoctorReviewLinkActionState> {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) {
    return {
      error: "Request is required.",
      reviewUrl: "",
      expiresAt: "",
    };
  }

  const owned = await getOwnedOpsRequest(requestId);
  if (!owned) {
    return {
      error: "You can only share links for your own requests.",
      reviewUrl: "",
      expiresAt: "",
    };
  }

  const token = generateDoctorReviewToken();
  const tokenHash = hashDoctorReviewToken(token);
  const expiresAt = new Date(
    Date.now() + DOCTOR_REVIEW_LINK_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const adminClient = createAdminClient();
  await adminClient
    .from("doctor_review_sessions")
    .update({ status: "revoked" })
    .eq("request_id", owned.request.id)
    .eq("status", "active");

  const { error } = await adminClient.from("doctor_review_sessions").insert({
    request_id: owned.request.id,
    created_by: owned.userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    base_doctor_name: owned.request.doctor_name,
    base_form_data: buildDoctorReviewFormSnapshot(owned.request.form_data),
  });

  if (error) {
    return {
      error: error.message,
      reviewUrl: "",
      expiresAt: "",
    };
  }

  const reviewUrl = buildDoctorReviewLink(await getRequestBaseUrl(), token);

  revalidatePath(`/requests/${requestId}`);

  return {
    error: "",
    reviewUrl,
    expiresAt,
  };
}

export async function revokeDoctorReviewLinkAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) {
    return;
  }

  const owned = await getOwnedOpsRequest(requestId);
  if (!owned) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient
    .from("doctor_review_sessions")
    .update({ status: "revoked" })
    .eq("request_id", owned.request.id)
    .eq("status", "active");

  revalidatePath(`/requests/${requestId}`);
}

export async function applyDoctorReviewChangesAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  const sessionId = String(formData.get("session_id") ?? "").trim();
  if (!requestId || !sessionId) {
    return;
  }

  const owned = await getOwnedOpsRequest(requestId);
  if (!owned) {
    return;
  }

  const adminClient = createAdminClient();
  const { data: session } = await adminClient
    .from("doctor_review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("request_id", owned.request.id)
    .maybeSingle<DoctorReviewSessionRow>();

  if (!session || session.status !== "submitted" || !session.submitted_form_data) {
    return;
  }

  const mergedFormData = {
    ...owned.request.form_data,
    ...session.submitted_form_data,
  };

  const { error: updateRequestError } = await adminClient
    .from("requests")
    .update({
      doctor_name: session.submitted_doctor_name?.trim() || owned.request.doctor_name,
      form_data: mergedFormData,
    })
    .eq("id", owned.request.id);

  if (updateRequestError) {
    console.error(updateRequestError.message);
    return;
  }

  const { error: updateSessionError } = await adminClient
    .from("doctor_review_sessions")
    .update({ status: "applied" })
    .eq("id", session.id)
    .eq("status", "submitted");

  if (updateSessionError) {
    console.error(updateSessionError.message);
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
  revalidatePath("/dashboard");
}

export async function submitDoctorReviewAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const doctorName = String(formData.get("doctor_name") ?? "").trim();

  if (!token || !doctorName) {
    redirect(`/doctor-review/${token}?error=Please complete the form before submitting.`);
  }

  const adminClient = createAdminClient();
  const tokenHash = hashDoctorReviewToken(token);
  const { data: session } = await adminClient
    .from("doctor_review_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle<DoctorReviewSessionRow>();

  if (!session) {
    redirect(`/doctor-review/${token}?error=This review link is invalid.`);
  }

  if (session.status !== "active") {
    redirect(`/doctor-review/${token}?error=This review link is no longer editable.`);
  }

  if (isDoctorReviewExpired(session)) {
    await adminClient
      .from("doctor_review_sessions")
      .update({ status: "revoked" })
      .eq("id", session.id)
      .eq("status", "active");

    redirect(`/doctor-review/${token}?error=This review link has expired.`);
  }

  const submittedFormData = collectDoctorReviewSubmission(formData);
  const { error } = await adminClient
    .from("doctor_review_sessions")
    .update({
      status: "submitted",
      submitted_doctor_name: doctorName,
      submitted_form_data: submittedFormData,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "active");

  if (error) {
    redirect(`/doctor-review/${token}?error=${encodeURIComponent(error.message)}`);
  }

  const { data: request } = await adminClient
    .from("requests")
    .select("doctor_name,created_by")
    .eq("id", session.request_id)
    .maybeSingle<{ doctor_name: string; created_by: string }>();

  if (request) {
    await sendPushNotifications(
      { userIds: [request.created_by] },
      {
        title: "Doctor Updated The Draft",
        body: `${request.doctor_name} reviewed the draft form and sent updates back for your approval.`,
        urlsByRole: {
          ops: `/requests/${session.request_id}`,
        },
        tag: `doctor-form-review-${session.request_id}`,
      },
    );
  }

  revalidatePath(`/requests/${session.request_id}`);
  redirect(`/doctor-review/${token}?submitted=1`);
}
