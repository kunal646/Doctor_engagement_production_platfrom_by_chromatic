import { NextResponse } from "next/server";

import { extractResumeAutofill } from "@/lib/resume-autofill";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const MAX_RESUME_BYTES = 15 * 1024 * 1024;

export const runtime = "nodejs";

function getResumeAutofillErrorStatus(message: string) {
  if (
    message.includes("Legacy .doc files are not supported yet") ||
    message.includes("Unsupported file type") ||
    message.includes("Could not read the uploaded resume")
  ) {
    return 400;
  }

  if (message.includes("GOOGLE_AI_API_KEY is not configured")) {
    return 500;
  }

  if (
    message.includes("Resume extraction request failed") ||
    message.includes("Resume extraction returned an empty response")
  ) {
    return 502;
  }

  return 500;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,company_id")
    .eq("id", user.id)
    .single<{ role: UserRole; company_id: string | null }>();

  if (!profile || profile.role !== "ops" || !profile.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const resume = formData.get("resume");

  if (!(resume instanceof File) || resume.size === 0) {
    return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
  }

  if (resume.size > MAX_RESUME_BYTES) {
    return NextResponse.json(
      { error: "Resume is too large. Please upload a file smaller than 15MB." },
      { status: 400 },
    );
  }

  try {
    const result = await extractResumeAutofill(resume);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract resume details.";
    console.error("Resume autofill failed:", error);
    return NextResponse.json(
      { error: message },
      { status: getResumeAutofillErrorStatus(message) },
    );
  }
}
