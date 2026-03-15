"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { approveStoryboardAction, requestStoryboardRevisionAction } from "@/lib/actions";
import {
  buildDoctorReviewLink,
  buildDoctorStoryboardReviewSummary,
  DOCTOR_REVIEW_LINK_TTL_HOURS,
  generateDoctorReviewToken,
  getRequestBaseUrl,
  hashDoctorReviewToken,
  isDoctorReviewExpired,
  parseStoryboardReviewSelections,
  validateStoryboardSelectionsAgainstSlides,
} from "@/lib/doctor-storyboard-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DoctorStoryboardReviewSessionRow,
  RequestRow,
  StoryboardRow,
} from "@/lib/types";
import { sendPushNotifications } from "@/lib/push-notifications";

export interface DoctorStoryboardReviewLinkActionState {
  error: string;
  reviewUrl: string;
  expiresAt: string;
}

async function getOwnedStoryboardReviewRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id,created_by,status")
    .eq("id", requestId)
    .maybeSingle<Pick<RequestRow, "id" | "created_by" | "status">>();

  if (!request || request.created_by !== user.id || request.status !== "storyboard_review") {
    return null;
  }

  return { userId: user.id, request };
}

export async function generateDoctorStoryboardReviewLinkAction(
  _previousState: DoctorStoryboardReviewLinkActionState,
  formData: FormData,
): Promise<DoctorStoryboardReviewLinkActionState> {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) {
    return { error: "Request is required.", reviewUrl: "", expiresAt: "" };
  }

  const owned = await getOwnedStoryboardReviewRequest(requestId);
  if (!owned) {
    return {
      error: "Only your own storyboard reviews can be shared.",
      reviewUrl: "",
      expiresAt: "",
    };
  }

  const adminClient = createAdminClient();
  const { data: storyboard } = await adminClient
    .from("storyboards")
    .select("*")
    .eq("request_id", requestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<StoryboardRow>();

  if (!storyboard) {
    return {
      error: "No storyboard is available to share yet.",
      reviewUrl: "",
      expiresAt: "",
    };
  }

  await adminClient
    .from("doctor_storyboard_review_sessions")
    .update({ status: "revoked" })
    .eq("request_id", requestId)
    .eq("status", "active");

  const token = generateDoctorReviewToken();
  const expiresAt = new Date(
    Date.now() + DOCTOR_REVIEW_LINK_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await adminClient.from("doctor_storyboard_review_sessions").insert({
    request_id: requestId,
    storyboard_id: storyboard.id,
    storyboard_version: storyboard.version,
    created_by: owned.userId,
    token_hash: hashDoctorReviewToken(token),
    expires_at: expiresAt,
    storyboard_storage_path: storyboard.storage_path,
    storyboard_slides: storyboard.slides,
  });

  if (error) {
    return { error: error.message, reviewUrl: "", expiresAt: "" };
  }

  revalidatePath(`/requests/${requestId}`);

  return {
    error: "",
    reviewUrl: buildDoctorReviewLink(await getRequestBaseUrl(), token).replace(
      "/doctor-review/",
      "/doctor-storyboard-review/",
    ),
    expiresAt,
  };
}

export async function revokeDoctorStoryboardReviewLinkAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) {
    return;
  }

  const owned = await getOwnedStoryboardReviewRequest(requestId);
  if (!owned) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient
    .from("doctor_storyboard_review_sessions")
    .update({ status: "revoked" })
    .eq("request_id", requestId)
    .eq("status", "active");

  revalidatePath(`/requests/${requestId}`);
}

export async function applyDoctorStoryboardReviewAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "").trim();
  const sessionId = String(formData.get("session_id") ?? "").trim();

  if (!requestId || !sessionId) {
    return;
  }

  const owned = await getOwnedStoryboardReviewRequest(requestId);
  if (!owned) {
    return;
  }

  const adminClient = createAdminClient();
  const { data: session } = await adminClient
    .from("doctor_storyboard_review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("request_id", requestId)
    .maybeSingle<DoctorStoryboardReviewSessionRow>();

  if (!session || session.status !== "submitted" || !session.submitted_decision) {
    return;
  }

  if (session.submitted_decision === "approve") {
    const actionFormData = new FormData();
    actionFormData.set("request_id", requestId);
    await approveStoryboardAction(actionFormData);
  } else {
    const summary = buildDoctorStoryboardReviewSummary(
      session.submitted_decision,
      session.submitted_comment ?? "",
      session.submitted_selections ?? [],
    );

    const actionFormData = new FormData();
    actionFormData.set("request_id", requestId);
    if ((session.submitted_selections?.length ?? 0) > 0) {
      actionFormData.set(
        "selections_json",
        JSON.stringify(session.submitted_selections ?? []),
      );
    }

    if (session.submitted_comment?.trim()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await adminClient.from("storyboard_comments").insert({
          request_id: requestId,
          user_id: user.id,
          comment: `Doctor overall storyboard feedback:\n\n${session.submitted_comment.trim()}`,
        });
      }
    }

    if (summary && (session.submitted_selections?.length ?? 0) === 0) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await adminClient.from("storyboard_comments").insert({
          request_id: requestId,
          user_id: user.id,
          comment: summary,
        });
      }
    }

    await requestStoryboardRevisionAction(actionFormData);
  }

  await adminClient
    .from("doctor_storyboard_review_sessions")
    .update({ status: "applied" })
    .eq("id", session.id)
    .eq("status", "submitted");

  revalidatePath(`/requests/${requestId}`);
}

export async function submitDoctorStoryboardReviewAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const overallComment = String(formData.get("overall_comment") ?? "").trim();

  if (!token || (decision !== "approve" && decision !== "changes_requested")) {
    redirect(`/doctor-storyboard-review/${token}?error=Please choose a review decision.`);
  }

  const tokenHash = hashDoctorReviewToken(token);
  const adminClient = createAdminClient();
  const { data: session } = await adminClient
    .from("doctor_storyboard_review_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle<DoctorStoryboardReviewSessionRow>();

  if (!session) {
    redirect(`/doctor-storyboard-review/${token}?error=This review link is invalid.`);
  }

  if (session.status !== "active") {
    redirect(`/doctor-storyboard-review/${token}?error=This review link is no longer editable.`);
  }

  if (isDoctorReviewExpired(session)) {
    await adminClient
      .from("doctor_storyboard_review_sessions")
      .update({ status: "revoked" })
      .eq("id", session.id)
      .eq("status", "active");

    redirect(`/doctor-storyboard-review/${token}?error=This review link has expired.`);
  }

  let selections = [];
  try {
    selections = parseStoryboardReviewSelections(
      String(formData.get("selections_json") ?? "[]"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid storyboard feedback.";
    redirect(`/doctor-storyboard-review/${token}?error=${encodeURIComponent(message)}`);
  }

  if (
    selections.length > 0 &&
    !validateStoryboardSelectionsAgainstSlides(selections, session.storyboard_slides)
  ) {
    redirect(`/doctor-storyboard-review/${token}?error=Invalid slide feedback was submitted.`);
  }

  if (
    decision === "changes_requested" &&
    !overallComment &&
    selections.length === 0
  ) {
    redirect(
      `/doctor-storyboard-review/${token}?error=Please add change details before submitting.`,
    );
  }

  const { error } = await adminClient
    .from("doctor_storyboard_review_sessions")
    .update({
      status: "submitted",
      submitted_decision: decision,
      submitted_comment: overallComment || null,
      submitted_selections: selections,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "active");

  if (error) {
    redirect(`/doctor-storyboard-review/${token}?error=${encodeURIComponent(error.message)}`);
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
        title: "Doctor Reviewed The Storyboard",
        body: `${request.doctor_name} responded to storyboard v${session.storyboard_version}. Review the feedback and confirm the next step.`,
        urlsByRole: {
          ops: `/requests/${session.request_id}`,
        },
        tag: `doctor-storyboard-review-${session.request_id}`,
      },
    );
  }

  revalidatePath(`/requests/${session.request_id}`);
  redirect(`/doctor-storyboard-review/${token}?submitted=1`);
}
