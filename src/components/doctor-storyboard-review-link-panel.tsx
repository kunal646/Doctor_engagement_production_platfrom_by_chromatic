"use client";

import { useActionState, useState } from "react";
import { CheckIcon, CopyIcon, EyeIcon } from "lucide-react";

import {
  applyDoctorStoryboardReviewAction,
  type DoctorStoryboardReviewLinkActionState,
  generateDoctorStoryboardReviewLinkAction,
  revokeDoctorStoryboardReviewLinkAction,
} from "@/lib/doctor-storyboard-review-actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface DoctorStoryboardReviewLinkPanelProps {
  requestId: string;
  session: {
    id: string;
    status: "active" | "submitted" | "revoked" | "applied";
    decision: "approve" | "changes_requested" | null;
    expiresAt: string;
    submittedAt: string | null;
    feedbackCount: number;
    isExpired: boolean;
    storyboardVersion: number;
  } | null;
}

export function DoctorStoryboardReviewLinkPanel({
  requestId,
  session,
}: DoctorStoryboardReviewLinkPanelProps) {
  const initialState: DoctorStoryboardReviewLinkActionState = {
    error: "",
    reviewUrl: "",
    expiresAt: "",
  };
  const [state, generateAction] = useActionState(
    generateDoctorStoryboardReviewLinkAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!state.reviewUrl) {
      return;
    }
    await navigator.clipboard.writeText(state.reviewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <EyeIcon className="size-4" />
          Doctor Storyboard Review
        </CardTitle>
        <CardDescription>
          Share the current storyboard version with the doctor and decide later whether to apply
          their response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session?.status === "active" && !session.isExpired ? (
          <p className="text-sm text-muted-foreground">
            An active doctor review link exists for storyboard v{session.storyboardVersion} until{" "}
            {new Date(session.expiresAt).toLocaleString()}.
          </p>
        ) : null}

        {session?.status === "submitted" ? (
          <p className="text-sm text-muted-foreground">
            Doctor submitted a{" "}
            <span className="font-medium">
              {session.decision === "approve" ? "approval" : "change request"}
            </span>
            {session.submittedAt ? ` on ${new Date(session.submittedAt).toLocaleString()}` : ""}.
          </p>
        ) : null}

        {session?.isExpired ? (
          <p className="text-sm text-muted-foreground">
            The latest doctor storyboard review link has expired.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <form action={generateAction}>
            <input type="hidden" name="request_id" value={requestId} />
            <SubmitButton type="submit" size="sm">
              {session?.status === "active" && !session.isExpired ? "Regenerate Link" : "Generate Review Link"}
            </SubmitButton>
          </form>
          {session?.status === "active" && !session.isExpired ? (
            <form action={revokeDoctorStoryboardReviewLinkAction}>
              <input type="hidden" name="request_id" value={requestId} />
              <SubmitButton type="submit" size="sm" variant="outline">
                Revoke Link
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {state.reviewUrl && session?.status === "active" && !session.isExpired ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Latest generated link</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={state.reviewUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {copied ? <CheckIcon className="mr-2 size-4" /> : <CopyIcon className="mr-2 size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        {session?.status === "submitted" ? (
          <div className="space-y-3">
            {session.feedbackCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                {session.feedbackCount} feedback item{session.feedbackCount === 1 ? "" : "s"} captured
                from the doctor.
              </p>
            ) : null}
            <form action={applyDoctorStoryboardReviewAction}>
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="session_id" value={session.id} />
              <SubmitButton type="submit" size="sm">
                {session.decision === "approve" ? "Approve Using Doctor Review" : "Request Revision Using Doctor Review"}
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
