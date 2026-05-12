import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon, FilmIcon, VideoIcon } from "lucide-react";

import { AdminUploadForms } from "@/components/admin-upload-forms";
import { CommentThread } from "@/components/comment-thread";
import { JsonCopyPanel } from "@/components/json-copy-panel";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PdfViewer } from "@/components/pdf-viewer";
import { RequestFormPreview } from "@/components/request-form-preview";
import { RequestRealtimeRefresh } from "@/components/request-realtime-refresh";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { StatusBadge } from "@/components/status-badge";
import { VideoPlayer } from "@/components/video-player";
import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { resolveRequestFieldCopy } from "@/config/request-form-doctor-type-copy";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateRequestStatusAction } from "@/lib/actions";
import { STATUS_OPTIONS } from "@/lib/constants";
import { getRequestImageAssets } from "@/lib/request-image-assets";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";
import {
  parseAdditionalReferencePhotos,
  parseAssetPathStrings,
} from "@/lib/additional-reference-photos";
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

function formatPreviewValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

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

  const enrichedFormData: JsonRecord = {
    doctor_name: request.doctor_name,
    ...request.form_data,
  };
  const assetPaths = parseAssetPathStrings(request.form_data.asset_paths);
  const signedAssetUrlMap = new Map<string, string>();
  if (assetPaths.length > 0) {
    for (const path of assetPaths) {
      const { data } = await supabase.storage
        .from("request-assets")
        .createSignedUrl(path, 60 * 60 * 24);
      if (data?.signedUrl) {
        signedAssetUrlMap.set(path, data.signedUrl);
      }
    }
  }
  const journeyAudioPath =
    typeof request.form_data.journey_audio_path === "string"
      ? request.form_data.journey_audio_path
      : "";
  const journeyAudioUrl = journeyAudioPath ? signedAssetUrlMap.get(journeyAudioPath) ?? "" : "";
  const doctorType = formatPreviewValue(request.form_data.doctor_type);
  const personalJourneyField = REQUEST_FORM_FIELDS.find(
    (field) => field.key === "personal_journey",
  );
  const additionalReferencePhotos = parseAdditionalReferencePhotos(
    request.form_data.additional_reference_photos,
  );
  const requestImageAssets = getRequestImageAssets(request.form_data);
  const referenceImageCount = requestImageAssets.filter(
    (asset) => asset.group === "reference",
  ).length;
  const supportingImageCount = requestImageAssets.filter(
    (asset) => asset.group === "supporting",
  ).length;
  const previewFields = [
    {
      key: "doctor_name",
      label: "Full Name",
      value: request.doctor_name,
      section: "Basic Details",
      required: true,
      description: "Include the preferred prefix such as Dr. or Prof.",
    },
    {
      key: "doctor_type",
      label: "Doctor Type",
      value: doctorType,
      section: "Basic Details",
      required: true,
      description: "Key opinion leader (KOL), key brand leader (KBL), or a general participant.",
    },
    ...REQUEST_FORM_FIELDS.filter(
      (field) => field.active !== false && field.key !== "personal_journey",
    ).map((field) => {
      const copy = resolveRequestFieldCopy(field, doctorType);
      return {
        key: field.key,
        label: copy.label,
        value: formatPreviewValue(request.form_data[field.key]),
        section: "Professional Details",
        required: field.required,
        description: copy.description,
      };
    }),
    {
      key: "personal_journey",
      label: personalJourneyField?.label ?? "Tell us about your journey",
      value: formatPreviewValue(request.form_data.personal_journey),
      section: "Personal Journey",
      description: personalJourneyField?.description,
    },
    {
      key: "journey_audio",
      label: "Journey Audio",
      value: journeyAudioUrl ? "Audio note attached" : "",
      section: "Personal Journey",
    },
    {
      key: "young_photo_age",
      label: "Age in Younger Photo",
      value: formatPreviewValue(request.form_data.young_photo_age),
      section: "Reference Photos",
      required: true,
    },
    {
      key: "current_photo_age",
      label: "Current Age in Recent Photo",
      value: formatPreviewValue(request.form_data.current_photo_age),
      section: "Reference Photos",
      required: true,
    },
    {
      key: "reference_photo_count",
      label: "Reference Photos Uploaded",
      value: referenceImageCount > 0 ? `${referenceImageCount} photo${referenceImageCount === 1 ? "" : "s"}` : "",
      section: "Reference Photos",
      required: true,
    },
    {
      key: "additional_reference_photo_ages",
      label: "Optional Reference Photo Ages",
      value: additionalReferencePhotos
        .map((photo, index) => `Photo ${index + 1}: age ${photo.age}`)
        .join("\n"),
      section: "Reference Photos",
    },
    {
      key: "supporting_photo_count",
      label: "Supporting Photos Uploaded",
      value:
        supportingImageCount > 0
          ? `${supportingImageCount} photo${supportingImageCount === 1 ? "" : "s"}`
          : "",
      section: "Reference Photos",
    },
  ];
  const requestImageGroups = [
    {
      key: "reference",
      title: "Reference Photos",
      items: requestImageAssets.filter((asset) => asset.group === "reference"),
    },
    {
      key: "supporting",
      title: "Supporting Photos",
      items: requestImageAssets.filter((asset) => asset.group === "supporting"),
    },
  ].filter((group) => group.items.length > 0);

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

            <RequestFormPreview fields={previewFields} />

            {requestImageGroups.length > 0 ? (
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Request Images</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Preview uploaded images or download them together as a ZIP.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/admin/requests/${request.id}/images`}>
                      <DownloadIcon className="mr-2 size-4" />
                      Download ZIP
                    </a>
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-5">
                  {requestImageGroups.map((group) => {
                    const lightboxItems = group.items
                      .map((asset) => {
                        const url = signedAssetUrlMap.get(asset.path);
                        return url ? { url, label: asset.label } : null;
                      })
                      .filter((item): item is { url: string; label: string } => item !== null);
                    if (lightboxItems.length === 0) {
                      return null;
                    }
                    return (
                      <div key={group.key} className="grid gap-3">
                        <p className="text-sm font-medium">{group.title}</p>
                        <PhotoLightbox photos={lightboxItems} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            <JsonCopyPanel data={enrichedFormData} />

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
