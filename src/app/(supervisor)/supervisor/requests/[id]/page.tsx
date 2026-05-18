import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, EyeIcon, FilmIcon, VideoIcon } from "lucide-react";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { CommentThread } from "@/components/comment-thread";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PdfViewer } from "@/components/pdf-viewer";
import { RequestRealtimeRefresh } from "@/components/request-realtime-refresh";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { StatusBadge } from "@/components/status-badge";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  parseAdditionalReferencePhotos,
  parseAssetPathStrings,
} from "@/lib/additional-reference-photos";
import {
  getSupportingPhotoConfig,
  groupSupportingPhotosByField,
  parseSupportingPhotos,
} from "@/lib/supporting-photos";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";
import { requestSubmittedDetailRow } from "@/lib/request-submitted-at";
import { createClient } from "@/lib/supabase/server";
import {
  Profile,
  RequestRow,
  StoryboardCommentRow,
  StoryboardRow,
  VideoRow,
} from "@/lib/types";

const fieldLabelMap = new Map(REQUEST_FORM_FIELDS.map((f) => [f.key, f.label]));

function getFieldLabel(key: string) {
  return (
    fieldLabelMap.get(key) ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default async function SupervisorRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single<RequestRow>();

  if (!request) {
    notFound();
  }

  if (request.status === "draft") {
    notFound();
  }

  const { data: createdByProfile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", request.created_by)
    .single<Pick<Profile, "full_name" | "email">>();

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

  const assetPaths = parseAssetPathStrings(request.form_data.asset_paths);
  const signedAssetUrls = new Map<string, string>();
  for (const path of assetPaths) {
    const { data } = await supabase.storage
      .from("request-assets")
      .createSignedUrl(path, 60 * 60 * 24);
    if (data?.signedUrl) {
      signedAssetUrls.set(path, data.signedUrl);
    }
  }

  const youngPhotoPath =
    typeof request.form_data.young_photo_path === "string"
      ? request.form_data.young_photo_path
      : "";
  const currentPhotoPath =
    typeof request.form_data.current_photo_path === "string"
      ? request.form_data.current_photo_path
      : "";
  const journeyAudioPath =
    typeof request.form_data.journey_audio_path === "string"
      ? request.form_data.journey_audio_path
      : "";
  const youngPhotoUrl = youngPhotoPath ? signedAssetUrls.get(youngPhotoPath) ?? null : null;
  const currentPhotoUrl = currentPhotoPath ? signedAssetUrls.get(currentPhotoPath) ?? null : null;
  const journeyAudioUrl = journeyAudioPath
    ? signedAssetUrls.get(journeyAudioPath) ?? null
    : null;

  const requestDetails = Object.entries(request.form_data).filter(
    ([key]) =>
      key !== "asset_paths" &&
      key !== "young_photo_path" &&
      key !== "current_photo_path" &&
      key !== "journey_audio_path" &&
      key !== "additional_reference_photos" &&
      key !== "supporting_photos",
  );

  const additionalReferencePhotos = parseAdditionalReferencePhotos(
    request.form_data.additional_reference_photos,
  );
  const additionalReferenceLightboxItems = additionalReferencePhotos
    .map((entry) => {
      const url = signedAssetUrls.get(entry.path);
      return url ? { url, label: `Reference photo (age ${entry.age})` } : null;
    })
    .filter((item): item is { url: string; label: string } => item !== null);
  const supportingPhotoGroups = groupSupportingPhotosByField(
    parseSupportingPhotos(request.form_data.supporting_photos),
  );

  const hasSlideStoryboard = hasSlideMetadata;
  const hasRenderableSlides = latestStoryboardSlides.length > 0;
  const operatorName = createdByProfile?.full_name || createdByProfile?.email || "Unknown";
  const intakeRow = requestSubmittedDetailRow(request);

  return (
    <div className="flex flex-col">
      <RequestRealtimeRefresh requestId={request.id} />
      <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-4 backdrop-blur-sm md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-11 w-11 shrink-0">
              <Link href="/supervisor/dashboard">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Supervisor Request View
              </p>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.02em]">
                  {request.doctor_name}
                </h1>
                <StatusBadge status={request.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-14 md:pl-0">
            <span className="rounded-sm border px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {request.id.slice(0, 8)}
            </span>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <EyeIcon className="size-3" />
              Read Only
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-8 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)] xl:items-start">
          <div className="flex flex-col gap-6">
            {videoUrl && (
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
            )}

            {latestStoryboard && (hasSlideStoryboard || latestStoryboardUrl) ? (
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">
                    Storyboard (v{latestStoryboard.version})
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {new Date(latestStoryboard.created_at).toLocaleDateString()}
                  </span>
                </CardHeader>
                <CardContent>
                  {hasSlideStoryboard ? (
                    hasRenderableSlides ? (
                      <StoryboardSlideGallery slides={latestStoryboardSlides} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Storyboard slides could not be loaded right now.
                      </p>
                    )
                  ) : (
                    latestStoryboardUrl ? <PdfViewer url={latestStoryboardUrl} /> : null
                  )}
                </CardContent>
              </Card>
            ) : (
              !videoUrl && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-sm border bg-muted/50 p-4">
                      <FilmIcon className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-sm font-medium">No storyboard yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Production team is working on this request.
                    </p>
                  </CardContent>
                </Card>
              )
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <CommentThread
                  requestId={request.id}
                  comments={comments ?? []}
                  canComment={false}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Operator
                  </span>
                  <span>{operatorName}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {intakeRow.label}
                  </span>
                  <span>{intakeRow.value}</span>
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
                <Separator />
                {requestDetails.map(([key, value]) => (
                  <div key={key} className="grid gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {getFieldLabel(key)}
                    </span>
                    <span className="whitespace-pre-wrap wrap-break-word">
                      {Array.isArray(value)
                        ? value.join(", ") || "-"
                        : String(value).trim() || "-"}
                    </span>
                  </div>
                ))}
                {youngPhotoUrl || currentPhotoUrl || additionalReferenceLightboxItems.length > 0 ? (
                  <>
                    <Separator />
                    <div className="grid gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Reference Photos
                      </span>
                      <PhotoLightbox
                        photos={[
                          ...(youngPhotoUrl
                            ? [{ url: youngPhotoUrl, label: "Younger Photo" }]
                            : []),
                          ...(currentPhotoUrl
                            ? [{ url: currentPhotoUrl, label: "Current Photo" }]
                            : []),
                          ...additionalReferenceLightboxItems,
                        ]}
                      />
                    </div>
                  </>
                ) : null}
                {supportingPhotoGroups.size > 0 ? (
                  <>
                    <Separator />
                    <div className="grid gap-5">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Supporting Photos
                      </span>
                      {Array.from(supportingPhotoGroups.entries()).map(([fieldKey, photos]) => {
                        const sectionLabel =
                          getSupportingPhotoConfig(fieldKey)?.label ?? getFieldLabel(fieldKey);
                        const lightboxItems = photos
                          .map((photo, index) => {
                            const url = signedAssetUrls.get(photo.path);
                            return url ? { url, label: `${sectionLabel} ${index + 1}` } : null;
                          })
                          .filter(
                            (item): item is { url: string; label: string } => item !== null,
                          );
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
                    </div>
                  </>
                ) : null}
                {journeyAudioUrl ? (
                  <>
                    <Separator />
                    <div className="grid gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Journey Audio
                      </span>
                      <audio controls preload="none" className="w-full">
                        <source src={journeyAudioUrl} />
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
