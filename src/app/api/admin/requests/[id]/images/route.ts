import JSZip from "jszip";
import { NextResponse } from "next/server";

import { getRequestImageAssets } from "@/lib/request-image-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RequestRow, UserRole } from "@/lib/types";

export const runtime = "nodejs";

function safeZipName(value: string) {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name || "request-images";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: UserRole }>();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id,doctor_name,status,form_data")
    .eq("id", id)
    .maybeSingle<Pick<RequestRow, "id" | "doctor_name" | "status" | "form_data">>();

  if (!request || request.status === "draft") {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const imageAssets = getRequestImageAssets(request.form_data);
  if (imageAssets.length === 0) {
    return NextResponse.json({ error: "No images found for this request" }, { status: 404 });
  }

  const adminClient = createAdminClient();
  const zip = new JSZip();
  const missingFiles: string[] = [];

  for (const asset of imageAssets) {
    const { data, error } = await adminClient.storage.from("request-assets").download(asset.path);
    if (error || !data) {
      missingFiles.push(asset.label);
      continue;
    }

    zip.file(asset.fileName, await data.arrayBuffer());
  }

  if (Object.keys(zip.files).length === 0) {
    return NextResponse.json({ error: "Could not load request images" }, { status: 500 });
  }

  if (missingFiles.length > 0) {
    zip.file(
      "missing-images.txt",
      `These images could not be added to the ZIP:\n${missingFiles.map((label) => `- ${label}`).join("\n")}\n`,
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const fileName = `${safeZipName(request.doctor_name)}-${request.id.slice(0, 8)}-images.zip`;

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
