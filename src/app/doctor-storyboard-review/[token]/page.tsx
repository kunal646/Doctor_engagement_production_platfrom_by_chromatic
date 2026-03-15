import { DoctorStoryboardFeedbackInput } from "@/components/doctor-storyboard-feedback-input";
import { PdfViewer } from "@/components/pdf-viewer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  hashDoctorReviewToken,
  isDoctorReviewExpired,
} from "@/lib/doctor-storyboard-review";
import { submitDoctorStoryboardReviewAction } from "@/lib/doctor-storyboard-review-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DoctorStoryboardReviewSessionRow,
} from "@/lib/types";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";

export const runtime = "nodejs";

function getStatusMessage(
  session: DoctorStoryboardReviewSessionRow | null,
  submitted: boolean,
) {
  if (!session) {
    return "This storyboard review link is invalid.";
  }

  if (submitted || session.status === "submitted" || session.status === "applied") {
    return "Thank you. This storyboard review has already been submitted.";
  }

  if (session.status === "revoked") {
    return "This storyboard review link has been revoked.";
  }

  if (isDoctorReviewExpired(session)) {
    return "This storyboard review link has expired.";
  }

  return "";
}

export default async function DoctorStoryboardReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const submitted = resolvedSearchParams.submitted === "1";

  const adminClient = createAdminClient();
  const { data: session } = await adminClient
    .from("doctor_storyboard_review_sessions")
    .select("*")
    .eq("token_hash", hashDoctorReviewToken(token))
    .maybeSingle<DoctorStoryboardReviewSessionRow>();

  const statusMessage = getStatusMessage(session, submitted);
  const slides = session?.storyboard_slides ?? [];
  const signedSlides: StoryboardSlideWithUrl[] = [];
  for (const slide of slides) {
    const { data } = await adminClient.storage
      .from("storyboards")
      .createSignedUrl(slide.path, 60 * 60 * 4);
    if (data?.signedUrl) {
      signedSlides.push({
        ...slide,
        url: data.signedUrl,
      });
    }
  }

  const storyboardUrl = session?.storyboard_storage_path
    ? (
        await adminClient.storage
          .from("storyboards")
          .createSignedUrl(session.storyboard_storage_path, 60 * 60 * 4)
      ).data?.signedUrl ?? null
    : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-start px-4 py-10 md:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Review Storyboard</CardTitle>
          <CardDescription>
            Please review the storyboard and let the team know whether it is approved or needs
            changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {resolvedSearchParams.error ? (
            <Alert variant="destructive">
              <AlertDescription>{resolvedSearchParams.error}</AlertDescription>
            </Alert>
          ) : null}

          {statusMessage ? (
            <Alert>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null}

          {!statusMessage && session ? (
            <form action={submitDoctorStoryboardReviewAction} className="space-y-6">
              <input type="hidden" name="token" value={token} />

              {signedSlides.length > 0 ? (
                <DoctorStoryboardFeedbackInput slides={signedSlides} />
              ) : storyboardUrl ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Storyboard v{session.storyboard_version}
                  </p>
                  <PdfViewer url={storyboardUrl} />
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    This storyboard could not be loaded right now.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label>Decision *</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="decision" value="approve" required />
                    Approve storyboard
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="decision" value="changes_requested" required />
                    Request changes
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overall_comment">Overall Feedback</Label>
                <Textarea
                  id="overall_comment"
                  name="overall_comment"
                  rows={4}
                  placeholder="Add any overall comments for the team. If you are requesting changes, mention the main adjustments here."
                />
              </div>

              <SubmitButton type="submit">Submit Storyboard Review</SubmitButton>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
