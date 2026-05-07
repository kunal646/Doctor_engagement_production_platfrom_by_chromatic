import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilmIcon, VideoIcon } from "lucide-react";

import { AdminUploadForms } from "@/components/admin-upload-forms";
import { CommentThread } from "@/components/comment-thread";
import { JsonCopyPanel } from "@/components/json-copy-panel";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PdfViewer } from "@/components/pdf-viewer";
import { RequestRealtimeRefresh } from "@/components/request-realtime-refresh";
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
import { parseAssetPathStrings } from "@/lib/additional-reference-photos";
import {
  getSupportingPhotoConfig,
  groupSupportingPhotosByField,
  parseSupportingPhotos,
} from "@/lib/supporting-photos";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import {
  JsonRecord,
  RequestRow,
  StoryboardCommentRow,
  StoryboardRow,
  VideoRow,
} from "@/lib/types";

const selectClassName =
  "h-11 w-full rounded-sm border border-input bg-background px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

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
  const assetPaths = parseAssetPathStrings(request.form_data.asset_paths);
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
  const supportingPhotoGroups = groupSupportingPhotosByField(
    parseSupportingPhotos(request.form_data.supporting_photos),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8 lg:px-8">
      <RequestRealtimeRefresh requestId={request.id} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 border-b pb-5">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="h-11 w-11">
              <Link href="/admin/dashboard">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Admin Request View
              </p>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.02em]">
                  {request.doctor_name}
                </h1>
                <StatusBadge status={request.status} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {request.companies?.name ?? "Unknown Company"}
            </p>
            <form
              action={updateRequestStatusAction}
              className="grid gap-3 sm:grid-cols-[220px_auto] sm:items-center"
            >
              <input type="hidden" name="request_id" value={request.id} />
              <select
                name="status"
                defaultValue={request.status}
                className={selectClassName}
              >
                {STATUS_OPTIONS.filter((item) => item.value !== "draft").map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <SubmitButton type="submit">Update Status</SubmitButton>
            </form>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] xl:items-start">
          <div className="flex flex-col gap-6">
            {videoUrl ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <VideoIcon className="size-4" /> Final Video
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <VideoPlayer
                    url={videoUrl}
                    requestId={request.id}
                    initialDownloaded={Boolean(request.video_downloaded_at)}
                  />
                  {request.video_downloaded_at ? (
                    <p className="text-sm text-muted-foreground">
                      Downloaded {new Date(request.video_downloaded_at).toLocaleString()}
                      {videoDownloadedByProfile
                        ? ` by ${videoDownloadedByProfile.full_name || videoDownloadedByProfile.email || "User"}`
                        : ""}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {latestStoryboard && (hasSlideMetadata || latestStoryboardUrl) ? (
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base font-medium">
                    Storyboard (v{latestStoryboard.version})
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {new Date(latestStoryboard.created_at).toLocaleDateString()}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestStoryboardSlides.length > 0 ? (
                    <StoryboardSlideGallery slides={latestStoryboardSlides} />
                  ) : hasSlideMetadata ? (
                    <p className="text-sm text-muted-foreground">
                      Storyboard slides could not be loaded right now.
                    </p>
                  ) : latestStoryboardUrl ? (
                    <PdfViewer url={latestStoryboardUrl} />
                  ) : null}

                  <div className="rounded-sm border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Version History</p>
                    <div className="mt-3 space-y-2">
                      {(storyboards ?? []).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
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
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-sm border bg-muted/50 p-4">
                      <FilmIcon className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-sm font-medium">No storyboard uploaded</p>
                  </CardContent>
                </Card>
              )
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <CommentThread requestId={request.id} comments={comments ?? []} canComment />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <AdminUploadForms requestId={request.id} />

            <JsonCopyPanel data={enrichedFormData} />

            {supportingPhotoGroups.size > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Supporting Photos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5">
                  {Array.from(supportingPhotoGroups.entries()).map(([fieldKey, photos]) => {
                    const sectionLabel =
                      getSupportingPhotoConfig(fieldKey)?.label ??
                      fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const lightboxItems = photos
                      .map((photo, index) => {
                        const url = signedAssetUrlMap.get(photo.path);
                        return url ? { url, label: `${sectionLabel} ${index + 1}` } : null;
                      })
                      .filter((item): item is { url: string; label: string } => item !== null);
                    if (lightboxItems.length === 0) {
                      return null;
                    }
                    return (
                      <div key={fieldKey} className="grid gap-3">
                        <p className="text-sm font-medium">{sectionLabel}</p>
                        <PhotoLightbox photos={lightboxItems} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Created
                  </span>
                  <span>{new Date(request.created_at).toLocaleString()}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Revisions
                  </span>
                  <span>
                    {request.storyboard_revision_count} / {request.max_storyboard_revisions}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Request ID
                  </span>
                  <span className="font-mono text-xs">{request.id}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Video Downloaded
                  </span>
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
