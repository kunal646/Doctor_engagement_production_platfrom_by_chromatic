import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RequestRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { requestId?: string };
  const requestId = body.requestId?.trim() ?? "";

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const { data: existingRequest } = await supabase
    .from("requests")
    .select("id,status,video_downloaded_at")
    .eq("id", requestId)
    .maybeSingle<Pick<RequestRow, "id" | "status" | "video_downloaded_at">>();

  if (!existingRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (existingRequest.status !== "video_delivered") {
    return NextResponse.json({ error: "Video is not ready for download" }, { status: 400 });
  }

  if (!existingRequest.video_downloaded_at) {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("requests")
      .update({
        video_downloaded_at: new Date().toISOString(),
        video_downloaded_by: user.id,
      })
      .eq("id", requestId)
      .is("video_downloaded_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
