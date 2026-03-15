import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilmIcon, VideoIcon } from "lucide-react";

import { AdminUploadForms } from "@/components/admin-upload-forms";
import { CommentThread } from "@/components/comment-thread";
import { JsonCopyPanel } from "@/components/json-copy-panel";
import { PdfViewer } from "@/components/pdf-viewer";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { StatusBadge } from "@/components/status-badge";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateRequestStatusAction } from "@/lib/actions";
import { STATUS_OPTIONS } from "@/lib/constants";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import {
  JsonRecord,
  RequestRow,
  StoryboardCommentRow,
  StoryboardRow,
  VideoRow,
} from "@/lib/types";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("*, companies(name)")
    .eq("id", id)
    .single<RequestRow & { companies: { name: string } | null }>();

  if (!request) {
    notFound();
  }

  if (request.status === "draft") {
    notFound();
  }

  const { data: storyboards } = await supabase
    .from("storyboards")
    .select("*")
    .eq("request_id", id)
    .order("version", { ascending: false })
    .returns<StoryboardRow[]>();

  const latestStoryboard = storyboards?.[0] ?? null;
  const hasSlideMetadata = (latestStoryboard?.slides?.length ?? 0) > 0;
  const latestStoryboardSlides: StoryboardSlideWithUrl[] = [];
  for (const slide of [...(latestStoryboard?.slides ?? [])].sort((a, b) => a.order - b.order)) {
    const { data } = await supabase.storage
      .from("storyboards")
      .createSignedUrl(slide.path, 60 * 60 * 24);
    if (data?.signedUrl) {
      latestStoryboardSlides.push({
        ...slide,
        url: data.signedUrl,
      });
    }
  }

  const latestStoryboardUrl =
    !hasSlideMetadata && latestStoryboard?.storage_path
    ? (
        await supabase.storage
          .from("storyboards")
          .createSignedUrl(latestStoryboard.storage_path, 60 * 60 * 24)
      ).data?.signedUrl ?? null
    : (latestStoryboard?.pdf_url ?? null);

  const { data: comments } = await supabase
    .from("storyboard_comments")
    .select("id,comment,created_at,user_id,profiles!inner(full_name,email)")
    .eq("request_id", id)
    .order("created_at", { ascending: true })
    .returns<
      (StoryboardCommentRow & {
        profiles: { full_name: string | null; email: string | null };
      })[]
    >();

  const { data: video } = await supabase
    .from("videos")
    .select("*")
    .eq("request_id", id)
    .maybeSingle<VideoRow>();
  const { data: videoDownloadedByProfile } = request.video_downloaded_by
    ? await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", request.video_downloaded_by)
        .maybeSingle<{ full_name: string | null; email: string | null }>()
    : { data: null };
  const videoUrl = video?.storage_path
    ? (
        await supabase.storage
          .from("videos")
          .createSignedUrl(video.storage_path, 60 * 60 * 24)
      ).data?.signedUrl ?? null
    : (video?.video_url ?? null);

  const enrichedFormData: JsonRecord = { ...request.form_data };
  const rawAssetPaths = request.form_data.asset_paths;
  const assetPaths = Array.isArray(rawAssetPaths) ? rawAssetPaths : [];
  const signedAssetUrlMap = new Map<string, string>();
  if (assetPaths.length > 0) {
    const signedAssetUrls: string[] = [];
    for (const path of assetPaths) {
      const { data } = await supabase.storage
        .from("request-assets")
        .createSignedUrl(path, 60 * 60 * 24);
      if (data?.signedUrl) {
        signedAssetUrls.push(data.signedUrl);
        signedAssetUrlMap.set(path, data.signedUrl);
      }
    }
    enrichedFormData.asset_urls = signedAssetUrls;
  }
  if (typeof request.form_data.journey_audio_path === "string") {
    const signedJourneyAudioUrl = signedAssetUrlMap.get(request.form_data.journey_audio_path);
    if (signedJourneyAudioUrl) {
      enrichedFormData.journey_audio_url = signedJourneyAudioUrl;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href="/admin/dashboard">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {request.doctor_name}
            </h1>
            <StatusBadge status={request.status} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            {request.companies?.name ?? "Unknown Company"}
          </p>
          <form action={updateRequestStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="request_id" value={request.id} />
            <select
              name="status"
              defaultValue={request.status}
              className="h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.filter((item) => item.value !== "draft").map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SubmitButton type="submit" size="sm">
              Update
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Main Content Area */}
          
          {/* Video Section */}
          {videoUrl ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <VideoIcon className="size-4" /> Final Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoPlayer
                  url={videoUrl}
                  requestId={request.id}
                  initialDownloaded={Boolean(request.video_downloaded_at)}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Storyboard Section */}
          {latestStoryboard && (hasSlideMetadata || latestStoryboardUrl) ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  Storyboard (v{latestStoryboard.version})
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {new Date(latestStoryboard.created_at).toLocaleDateString()}
                </span>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {latestStoryboardSlides.length > 0 ? (
                  <StoryboardSlideGallery slides={latestStoryboardSlides} />
                ) : hasSlideMetadata ? (
                  <p className="text-sm text-muted-foreground">
                    Storyboard slides could not be loaded right now.
                  </p>
                ) : latestStoryboardUrl ? (
                  <PdfViewer url={latestStoryboardUrl} />
                ) : null}
                
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium">Version History</p>
                  <div className="mt-2 space-y-1">
                    {(storyboards ?? []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          v{item.version}
                          {item.slides?.length ? ` • ${item.slides.length} slides` : " • PDF"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
             !videoUrl && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <FilmIcon className="size-6 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-sm font-medium">No storyboard uploaded</p>
                </CardContent>
              </Card>
            )
          )}

          <CommentThread requestId={request.id} comments={comments ?? []} canComment />
        </div>

        <div className="flex flex-col gap-6">
          {/* Sidebar Area */}
          
          <AdminUploadForms requestId={request.id} />

          <JsonCopyPanel data={enrichedFormData} />
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Created</span>
                <span>{new Date(request.created_at).toLocaleString()}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Revisions</span>
                <span>{request.storyboard_revision_count} / {request.max_storyboard_revisions}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Request ID</span>
                <span className="font-mono text-xs">{request.id}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Video Downloaded</span>
                <span>
                  {request.video_downloaded_at
                    ? `${new Date(request.video_downloaded_at).toLocaleString()}${videoDownloadedByProfile ? ` by ${videoDownloadedByProfile.full_name || videoDownloadedByProfile.email || "User"}` : ""}`
                    : "Not yet"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
