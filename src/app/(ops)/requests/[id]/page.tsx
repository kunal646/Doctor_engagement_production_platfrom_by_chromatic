import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilmIcon, PencilIcon, VideoIcon } from "lucide-react";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { CommentThread } from "@/components/comment-thread";
import { DoctorReviewLinkPanel } from "@/components/doctor-review-link-panel";
import { DoctorStoryboardReviewLinkPanel } from "@/components/doctor-storyboard-review-link-panel";
import { HeaderActions } from "@/components/header-actions";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PdfViewer } from "@/components/pdf-viewer";
import { ReviewProvider } from "@/components/review-context";
import { StoryboardReviewPanel } from "@/components/storyboard-review-panel";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { StatusBadge } from "@/components/status-badge";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { countDoctorReviewChanges, isDoctorReviewExpired } from "@/lib/doctor-review";
import {
  countDoctorStoryboardReviewFeedback,
} from "@/lib/doctor-storyboard-review";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DoctorReviewSessionRow,
  DoctorStoryboardReviewSessionRow,
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

export default async function OpsRequestDetailPage({
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

  const adminClient = createAdminClient();
  const { data: doctorReviewSession } = await adminClient
    .from("doctor_review_sessions")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DoctorReviewSessionRow>();
  const { data: doctorStoryboardReviewSession } = await adminClient
    .from("doctor_storyboard_review_sessions")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DoctorStoryboardReviewSessionRow>();

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

  const rawAssetPaths = request.form_data.asset_paths;
  const assetPaths = Array.isArray(rawAssetPaths) ? rawAssetPaths : [];
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
      key !== "journey_audio_path",
  );

  const canComment =
    request.status === "storyboard_review" || request.status === "changes_requested";
  const canRequestRevision =
    request.status === "storyboard_review" &&
    request.storyboard_revision_count < request.max_storyboard_revisions;
  const hasRenderableSlides = latestStoryboardSlides.length > 0;
  const hasSlideStoryboard = hasSlideMetadata;
  const isInReview = request.status === "storyboard_review";
  const isSlideReview = isInReview && hasSlideStoryboard && hasRenderableSlides;
  const isDraft = request.status === "draft";

  return (
    <ReviewProvider>
      <div className="flex flex-col">
        {/* Sticky Header — flush with top of scroll area, full width */}
        <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur-sm md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
                <Link href="/dashboard">
                  <ArrowLeftIcon className="size-4" />
                </Link>
              </Button>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {request.doctor_name}
                </h1>
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 pl-11 md:pl-0">
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                {request.id.slice(0, 8)}
              </span>
              {isDraft ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/requests/${request.id}/edit`}>
                    <PencilIcon className="mr-2 size-4" />
                    Edit Draft
                  </Link>
                </Button>
              ) : null}
              {isInReview && (
                <HeaderActions
                  requestId={request.id}
                  canRequestRevision={canRequestRevision}
                  isSlideReview={isSlideReview}
                  commentCount={(comments ?? []).length}
                  revisionCount={request.storyboard_revision_count}
                  maxRevisions={request.max_storyboard_revisions}
                />
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="flex flex-col lg:col-span-2">
            {/* Video Section */}
            {videoUrl && (
              <section className="pb-6">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <VideoIcon className="size-4" /> Final Video
                </h2>
                <VideoPlayer
                  url={videoUrl}
                  requestId={request.id}
                  initialDownloaded={Boolean(request.video_downloaded_at)}
                />
                <Separator className="mt-6" />
              </section>
            )}

            {/* Storyboard Section */}
            {latestStoryboard && (hasSlideStoryboard || latestStoryboardUrl) ? (
              <section className="pb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Storyboard (v{latestStoryboard.version})
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {new Date(latestStoryboard.created_at).toLocaleDateString()}
                  </span>
                </div>
                {hasSlideStoryboard ? (
                  hasRenderableSlides ? (
                    isInReview ? (
                      <StoryboardReviewPanel
                        slides={latestStoryboardSlides}
                      />
                    ) : (
                      <StoryboardSlideGallery slides={latestStoryboardSlides} />
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Storyboard slides could not be loaded right now.
                    </p>
                  )
                ) : latestStoryboardUrl ? (
                  <PdfViewer url={latestStoryboardUrl} />
                ) : null}
                {!canRequestRevision && isInReview && (
                  <p className="mt-2 text-xs text-destructive">
                    Revision limit reached — you can only approve at this stage.
                  </p>
                )}
                <Separator className="mt-6" />
              </section>
            ) : (
              !videoUrl && (
                <section className="pb-6">
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <FilmIcon className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mt-2 text-sm font-medium">No storyboard yet</p>
                    <p className="text-xs text-muted-foreground">
                      Production team is working on your request.
                    </p>
                  </div>
                  <Separator />
                </section>
              )
            )}

            {/* Comments */}
            <section className="pt-2">
              <CommentThread
                requestId={request.id}
                comments={comments ?? []}
                canComment={canComment && !hasSlideStoryboard}
              />
            </section>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {isDraft ? (
              <DoctorReviewLinkPanel
                requestId={request.id}
                session={
                  doctorReviewSession
                    ? {
                        id: doctorReviewSession.id,
                        status: doctorReviewSession.status,
                        expiresAt: doctorReviewSession.expires_at,
                        submittedAt: doctorReviewSession.submitted_at,
                        changedFieldCount: countDoctorReviewChanges(doctorReviewSession),
                        isExpired:
                          doctorReviewSession.status === "active" &&
                          isDoctorReviewExpired(doctorReviewSession),
                      }
                    : null
                }
              />
            ) : null}
            {isInReview && (latestStoryboardSlides.length > 0 || latestStoryboardUrl) ? (
              <DoctorStoryboardReviewLinkPanel
                requestId={request.id}
                session={
                  doctorStoryboardReviewSession
                    ? {
                        id: doctorStoryboardReviewSession.id,
                        status: doctorStoryboardReviewSession.status,
                        decision: doctorStoryboardReviewSession.submitted_decision,
                        expiresAt: doctorStoryboardReviewSession.expires_at,
                        submittedAt: doctorStoryboardReviewSession.submitted_at,
                        feedbackCount: countDoctorStoryboardReviewFeedback(
                          doctorStoryboardReviewSession,
                        ),
                        isExpired:
                          doctorStoryboardReviewSession.status === "active" &&
                          isDoctorReviewExpired(doctorStoryboardReviewSession),
                        storyboardVersion: doctorStoryboardReviewSession.storyboard_version,
                      }
                    : null
                }
              />
            ) : null}
            <div>
              <h2 className="mb-4 text-sm font-medium">Request Details</h2>
              <div className="grid gap-4 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Submitted
                  </span>
                  <span>{new Date(request.created_at).toLocaleString()}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground">
                      {getFieldLabel(key)}
                    </span>
                    <span className="whitespace-pre-wrap wrap-break-word">
                      {Array.isArray(value)
                        ? value.join(", ") || "-"
                        : String(value).trim() || "-"}
                    </span>
                  </div>
                ))}
                {youngPhotoUrl || currentPhotoUrl ? (
                  <>
                    <Separator />
                    <div className="grid gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
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
                        ]}
                      />
                    </div>
                  </>
                ) : null}
                {journeyAudioUrl ? (
                  <>
                    <Separator />
                    <div className="grid gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Journey Audio
                      </span>
                      <audio controls preload="none" className="w-full">
                        <source src={journeyAudioUrl} />
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </ReviewProvider>
  );
}
