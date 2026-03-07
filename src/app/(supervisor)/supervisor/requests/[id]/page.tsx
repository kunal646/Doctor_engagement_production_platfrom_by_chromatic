import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, EyeIcon, FilmIcon, VideoIcon } from "lucide-react";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { CommentThread } from "@/components/comment-thread";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PdfViewer } from "@/components/pdf-viewer";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { StatusBadge } from "@/components/status-badge";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";
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
  const youngPhotoUrl = youngPhotoPath ? signedAssetUrls.get(youngPhotoPath) ?? null : null;
  const currentPhotoUrl = currentPhotoPath ? signedAssetUrls.get(currentPhotoPath) ?? null : null;

  const requestDetails = Object.entries(request.form_data).filter(
    ([key]) =>
      key !== "asset_paths" && key !== "young_photo_path" && key !== "current_photo_path",
  );

  const hasSlideStoryboard = hasSlideMetadata;
  const hasRenderableSlides = latestStoryboardSlides.length > 0;
  const operatorName = createdByProfile?.full_name || createdByProfile?.email || "Unknown";

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur-sm md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
              <Link href="/supervisor/dashboard">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {request.doctor_name}
              </h1>
              <StatusBadge status={request.status} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
              {request.id.slice(0, 8)}
            </span>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <EyeIcon className="size-3" />
              Read Only
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="flex flex-col lg:col-span-2">
            {videoUrl && (
              <section className="pb-6">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <VideoIcon className="size-4" /> Final Video
                </h2>
                <VideoPlayer url={videoUrl} />
                <Separator className="mt-6" />
              </section>
            )}

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
                    <StoryboardSlideGallery slides={latestStoryboardSlides} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Storyboard slides could not be loaded right now.
                    </p>
                  )
                ) : latestStoryboardUrl ? (
                  <PdfViewer url={latestStoryboardUrl} />
                ) : null}
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
                      Production team is working on this request.
                    </p>
                  </div>
                  <Separator />
                </section>
              )
            )}

            <section className="pt-2">
              <CommentThread
                requestId={request.id}
                comments={comments ?? []}
                canComment={false}
              />
            </section>
          </div>

          <div className="flex flex-col gap-6 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <h2 className="mb-4 text-sm font-medium">Request Details</h2>
              <div className="grid gap-4 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Operator
                  </span>
                  <span>{operatorName}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Submitted
                  </span>
                  <span>{new Date(request.created_at).toLocaleString()}</span>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
