"use client";

import { useActionState, useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";

import {
  applyDoctorReviewChangesAction,
  generateDoctorReviewLinkAction,
  type DoctorReviewLinkActionState,
  revokeDoctorReviewLinkAction,
} from "@/lib/doctor-review-actions";
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

interface DoctorReviewLinkPanelProps {
  requestId: string;
  session: {
    id: string;
    status: "active" | "submitted" | "revoked" | "applied";
    expiresAt: string;
    submittedAt: string | null;
    changedFieldCount: number;
    isExpired: boolean;
  } | null;
}

export function DoctorReviewLinkPanel({
  requestId,
  session,
}: DoctorReviewLinkPanelProps) {
  const initialState: DoctorReviewLinkActionState = {
    error: "",
    reviewUrl: "",
    expiresAt: "",
  };
  const [state, generateAction] = useActionState(
    generateDoctorReviewLinkAction,
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

  const generateLabel =
    session?.status === "active" && !session.isExpired
      ? "Regenerate Link"
      : "Generate Review Link";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LinkIcon className="size-4" />
          Doctor Review Link
        </CardTitle>
        <CardDescription>
          Generate a secure shareable link for the doctor to review and update this form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session?.status === "active" && !session.isExpired ? (
          <p className="text-sm text-muted-foreground">
            An active review link exists until {new Date(session.expiresAt).toLocaleString()}.
            For security, the full link is only shown immediately after generation.
          </p>
        ) : null}

        {session?.isExpired ? (
          <p className="text-sm text-muted-foreground">
            The latest doctor review link has expired.
          </p>
        ) : null}

        {session?.status === "submitted" ? (
          <p className="text-sm text-muted-foreground">
            Doctor review was submitted
            {session.submittedAt ? ` on ${new Date(session.submittedAt).toLocaleString()}` : ""}.
            {session.changedFieldCount > 0
              ? ` ${session.changedFieldCount} field${session.changedFieldCount === 1 ? "" : "s"} changed.`
              : " No field changes were detected."}
          </p>
        ) : null}

        {session?.status === "applied" ? (
          <p className="text-sm text-muted-foreground">
            The latest doctor review has already been applied to the request.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <form action={generateAction}>
            <input type="hidden" name="request_id" value={requestId} />
            <SubmitButton type="submit" size="sm">
              {generateLabel}
            </SubmitButton>
          </form>
          {session?.status === "active" && !session.isExpired ? (
            <form action={revokeDoctorReviewLinkAction}>
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
            {state.expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Expires on {new Date(state.expiresAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        {session?.status === "submitted" ? (
          <form action={applyDoctorReviewChangesAction}>
            <input type="hidden" name="request_id" value={requestId} />
            <input type="hidden" name="session_id" value={session.id} />
            <SubmitButton type="submit" size="sm">
              Apply Doctor Changes
            </SubmitButton>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
