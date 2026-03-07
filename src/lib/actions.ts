"use server";

import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { REQUEST_STATUSES } from "@/lib/constants";
import {
  buildStoryboardRevisionSummary,
  isStoryboardIssue,
  StoryboardRevisionSelection,
  StoryboardSlide,
} from "@/lib/storyboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { JsonRecord, RequestStatus } from "@/lib/types";

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
}

const STORYBOARD_ARCHIVE_MAX_BYTES = 40 * 1024 * 1024;
const STORYBOARD_SLIDE_MAX_COUNT = 50;
const STORYBOARD_ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function getFileExtension(fileName: string) {
  const normalized = fileName.toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

function getStoryboardContentType(fileName: string) {
  switch (getFileExtension(fileName)) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function isZipStoryboardFile(fileName: string, mimeType: string | undefined) {
  return getFileExtension(fileName) === ".zip" || mimeType === "application/zip";
}

async function extractStoryboardSlidesFromArchive(
  archiveBuffer: Buffer,
  requestId: string,
  version: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const archive = await JSZip.loadAsync(archiveBuffer);
  const entries = Object.values(archive.files)
    .filter((entry) => !entry.dir)
    .filter((entry) => {
      const normalized = entry.name.replace(/\\/g, "/");
      const baseName = normalized.split("/").pop() ?? normalized;
      if (!baseName || baseName === ".DS_Store") {
        return false;
      }
      if (normalized.startsWith("__MACOSX/")) {
        return false;
      }
      return STORYBOARD_ALLOWED_EXTENSIONS.has(getFileExtension(baseName));
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  if (entries.length === 0) {
    throw new Error("The ZIP does not contain any supported storyboard images.");
  }

  if (entries.length > STORYBOARD_SLIDE_MAX_COUNT) {
    throw new Error(`Storyboard ZIP can include up to ${STORYBOARD_SLIDE_MAX_COUNT} slides.`);
  }

  const slides: StoryboardSlide[] = [];

  for (const [index, entry] of entries.entries()) {
    const fileName = entry.name.replace(/\\/g, "/").split("/").pop() ?? `shot-${index + 1}.png`;
    const safeName = safeFileName(fileName);
    const outputPath = `${requestId}/v${version}/slides/${String(index + 1).padStart(2, "0")}-${safeName}`;
    const fileBuffer = await entry.async("nodebuffer");

    const { error: uploadError } = await supabase.storage
      .from("storyboards")
      .upload(outputPath, fileBuffer, {
        contentType: getStoryboardContentType(safeName),
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    slides.push({
      order: index + 1,
      path: outputPath,
      label: `Shot ${index + 1}`,
    });
  }

  return slides;
}

function parseStoryboardRevisionSelections(rawValue: string) {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("Invalid storyboard review payload.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid storyboard review payload.");
  }

  const selections: StoryboardRevisionSelection[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid storyboard review payload.");
    }

    const maybeOrder = "order" in item ? item.order : undefined;
    const maybeIssues = "issues" in item ? item.issues : undefined;

    if (
      typeof maybeOrder !== "number" ||
      !Number.isInteger(maybeOrder) ||
      maybeOrder <= 0 ||
      !Array.isArray(maybeIssues)
    ) {
      throw new Error("Invalid storyboard review payload.");
    }

    const issues = Array.from(
      new Set(maybeIssues.filter((issue): issue is string => typeof issue === "string")),
    ).filter(isStoryboardIssue);

    if (issues.length > 0) {
      selections.push({
        order: maybeOrder,
        issues,
      });
    }
  }

  return selections;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unable to load user after login." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "admin" | "ops" | "supervisor" }>();

  if (!profile) {
    return { error: "Profile not found. Ask admin to provision your account." };
  }

  const destinations: Record<string, string> = {
    admin: "/admin/dashboard",
    ops: "/dashboard",
    supervisor: "/supervisor/dashboard",
  };

  redirect(destinations[profile.role] ?? "/login");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createRequestAction(formData: FormData) {
  const doctorName = String(formData.get("doctor_name") ?? "").trim();
  if (!doctorName) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id,role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: string }>();

  if (!profile?.company_id || profile.role === "supervisor") {
    return;
  }

  const data: JsonRecord = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field_")) {
      const fieldKey = key.replace("field_", "");
      data[fieldKey] = String(value);
    }
  }

  const rawAssetPaths = String(formData.get("asset_paths_json") ?? "").trim();
  if (rawAssetPaths) {
    try {
      const parsed = JSON.parse(rawAssetPaths);
      if (Array.isArray(parsed)) {
        data.asset_paths = parsed.filter((entry) => typeof entry === "string");
      }
    } catch (error) {
      console.error("Invalid asset_paths_json", error);
    }
  }

  const youngPhotoPath = String(formData.get("young_photo_path") ?? "").trim();
  if (youngPhotoPath) {
    data.young_photo_path = youngPhotoPath;
  }

  const currentPhotoPath = String(formData.get("current_photo_path") ?? "").trim();
  if (currentPhotoPath) {
    data.current_photo_path = currentPhotoPath;
  }

  const { error } = await supabase.from("requests").insert({
    doctor_name: doctorName,
    company_id: profile.company_id,
    created_by: user.id,
    status: "form_submitted",
    form_data: data,
  });

  if (error) {
    console.error(error.message);
    return;
  }

  redirect("/dashboard");
}

export async function addCommentAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!requestId || !comment) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (userProfile?.role === "supervisor") {
    return;
  }

  const { data: request } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle<{ status: RequestStatus }>();

  const isCommentWindowOpen =
    request?.status === "storyboard_review" || request?.status === "changes_requested";

  if (!request || !isCommentWindowOpen) {
    return;
  }

  const { error } = await supabase.from("storyboard_comments").insert({
    request_id: requestId,
    user_id: user.id,
    comment,
  });

  if (error) {
    console.error(error.message);
    return;
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
}

export async function requestStoryboardRevisionAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const selectionsJson = String(formData.get("selections_json") ?? "").trim();
  if (!requestId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (actorProfile?.role === "supervisor") {
    return;
  }

  const { data: request } = await supabase
    .from("requests")
    .select("status,storyboard_revision_count,max_storyboard_revisions")
    .eq("id", requestId)
    .maybeSingle<{
      status: RequestStatus;
      storyboard_revision_count: number;
      max_storyboard_revisions: number;
    }>();

  if (!request || request.status !== "storyboard_review") {
    return;
  }

  let selections: StoryboardRevisionSelection[] = [];
  try {
    selections = parseStoryboardRevisionSelections(selectionsJson);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid storyboard review payload.");
    return;
  }
  const hasStructuredSelections = selections.length > 0;

  if (selectionsJson && !hasStructuredSelections) {
    return;
  }

  if (hasStructuredSelections) {
    const { data: latestStoryboard } = await supabase
      .from("storyboards")
      .select("slides")
      .eq("request_id", requestId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<{ slides: StoryboardSlide[] | null }>();

    const validOrders = new Set((latestStoryboard?.slides ?? []).map((slide) => slide.order));
    if (
      validOrders.size === 0 ||
      selections.some((selection) => !validOrders.has(selection.order))
    ) {
      return;
    }
  }

  const nextRevisionCount = request.storyboard_revision_count + 1;
  if (nextRevisionCount > request.max_storyboard_revisions) {
    return;
  }

  if (hasStructuredSelections) {
    const comment = buildStoryboardRevisionSummary(selections);
    if (!comment) {
      return;
    }

    const { error: commentError } = await supabase.from("storyboard_comments").insert({
      request_id: requestId,
      user_id: user.id,
      comment,
    });

    if (commentError) {
      console.error(commentError.message);
      return;
    }
  }

  const { error } = await supabase
    .from("requests")
    .update({
      status: "changes_requested",
      storyboard_revision_count: nextRevisionCount,
    })
    .eq("id", requestId)
    .eq("status", "storyboard_review");

  if (error) {
    console.error(error.message);
    return;
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
}

export async function approveStoryboardAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: approverProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (approverProfile?.role === "supervisor") {
    return;
  }

  const { error } = await supabase
    .from("requests")
    .update({ status: "storyboard_approved" })
    .eq("id", requestId)
    .eq("status", "storyboard_review");

  if (error) {
    console.error(error.message);
    return;
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
}

export async function updateRequestStatusAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const status = String(formData.get("status") ?? "") as RequestStatus;

  if (!requestId || !REQUEST_STATUSES.includes(status)) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", requestId);

  if (error) {
    console.error(error.message);
    return;
  }

  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
}

export async function uploadStoryboardAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const fileName = String(formData.get("file_name") ?? "").trim();
  const providedPath = String(formData.get("storage_path") ?? "").trim();
  const storyboardFile = formData.get("storyboard");
  const legacyPdfFile = formData.get("pdf");
  const file = storyboardFile instanceof File ? storyboardFile : legacyPdfFile;
  if (!requestId || (!providedPath && (!(file instanceof File) || file.size === 0))) {
    return { error: "Request and storyboard file are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: latest } = await supabase
    .from("storyboards")
    .select("version")
    .eq("request_id", requestId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();

  const nextVersion = (latest?.version ?? 0) + 1;
  let filePath = providedPath;
  const uploadName =
    fileName || (file instanceof File ? file.name : providedPath.split("/").pop() ?? "");

  let slides: StoryboardSlide[] | null = null;

  try {
    if (!filePath) {
      if (!(file instanceof File)) {
        return { error: "Storyboard file is missing." };
      }
      filePath = `${requestId}/v${nextVersion}-${safeFileName(file.name)}`;
      const uploadedBuffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("storyboards")
        .upload(filePath, uploadedBuffer, {
          contentType: getStoryboardContentType(file.name),
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError.message);
        return { error: uploadError.message };
      }

      if (isZipStoryboardFile(file.name, file.type)) {
        if (uploadedBuffer.byteLength > STORYBOARD_ARCHIVE_MAX_BYTES) {
          console.error("Storyboard ZIP is too large.");
          return { error: "Storyboard ZIP is too large." };
        }
        slides = await extractStoryboardSlidesFromArchive(uploadedBuffer, requestId, nextVersion, supabase);
      }
    } else if (isZipStoryboardFile(uploadName, undefined)) {
      const { data: archiveBlob, error: downloadError } = await supabase.storage
        .from("storyboards")
        .download(filePath);

      if (downloadError || !archiveBlob) {
        console.error(downloadError?.message ?? "Could not read storyboard archive.");
        return { error: downloadError?.message ?? "Could not read storyboard archive." };
      }

      const archiveBuffer = Buffer.from(await archiveBlob.arrayBuffer());
      if (archiveBuffer.byteLength > STORYBOARD_ARCHIVE_MAX_BYTES) {
        console.error("Storyboard ZIP is too large.");
        return { error: "Storyboard ZIP is too large." };
      }

      slides = await extractStoryboardSlidesFromArchive(archiveBuffer, requestId, nextVersion, supabase);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storyboard extraction failed.";
    console.error(message);
    return { error: message };
  }

  const { error: insertError } = await supabase.from("storyboards").insert({
    request_id: requestId,
    storage_path: filePath,
    slides,
    version: nextVersion,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error(insertError.message);
    return { error: insertError.message };
  }

  const { error: requestError } = await supabase
    .from("requests")
    .update({ status: "storyboard_review" })
    .eq("id", requestId);

  if (requestError) {
    console.error(requestError.message);
    return { error: requestError.message };
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
  return { success: true };
}

export async function uploadVideoAction(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const providedPath = String(formData.get("storage_path") ?? "").trim();
  const file = formData.get("video");
  if (!requestId || (!providedPath && (!(file instanceof File) || file.size === 0))) {
    return { error: "Request and video file are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  let filePath = providedPath;
  if (!filePath) {
    if (!(file instanceof File)) {
      return { error: "Video file is missing." };
    }
    filePath = `${requestId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError.message);
      return { error: uploadError.message };
    }
  }

  const { error: upsertError } = await supabase.from("videos").upsert(
    {
      request_id: requestId,
      storage_path: filePath,
      uploaded_by: user.id,
    },
    { onConflict: "request_id" },
  );

  if (upsertError) {
    console.error(upsertError.message);
    return { error: upsertError.message };
  }

  const { error: requestError } = await supabase
    .from("requests")
    .update({ status: "video_delivered" })
    .eq("id", requestId);

  if (requestError) {
    console.error(requestError.message);
    return { error: requestError.message };
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/supervisor/requests/${requestId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/supervisor/dashboard");
  return { success: true };
}

export async function createCompanyWithOpsAction(formData: FormData) {
  const companyName = String(formData.get("company_name") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ops").trim();

  if (!companyName || !fullName || !email || password.length < 8) {
    return;
  }

  if (role !== "ops" && role !== "supervisor") {
    return;
  }

  const adminClient = createAdminClient();

  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .insert({ name: companyName })
    .select("id")
    .single<{ id: string }>();

  if (companyError || !company) {
    console.error(companyError?.message ?? "Could not create company.");
    return;
  }

  const { data: createdUser, error: userError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (userError || !createdUser.user) {
    console.error(userError?.message ?? "Could not create auth user.");
    return;
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role,
    company_id: company.id,
  });

  if (profileError) {
    console.error(profileError.message);
    return;
  }

  revalidatePath("/admin/companies");
}

export async function addUserToCompanyAction(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ops").trim();

  if (!companyId || !fullName || !email || password.length < 8) {
    return;
  }

  if (role !== "ops" && role !== "supervisor") {
    return;
  }

  const adminClient = createAdminClient();

  const { data: createdUser, error: userError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (userError || !createdUser.user) {
    console.error(userError?.message ?? "Could not create auth user.");
    return;
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role,
    company_id: companyId,
  });

  if (profileError) {
    console.error(profileError.message);
    return;
  }

  revalidatePath("/admin/companies");
}
