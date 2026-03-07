"use client";

import { useMemo } from "react";

import { useReviewState } from "@/components/review-context";
import { SubmitButton } from "@/components/submit-button";
import {
  approveStoryboardAction,
  requestStoryboardRevisionAction,
} from "@/lib/actions";
import { StoryboardRevisionSelection } from "@/lib/storyboard";

interface HeaderActionsProps {
  requestId: string;
  canRequestRevision: boolean;
  isSlideReview: boolean;
  commentCount?: number;
  revisionCount: number;
  maxRevisions: number;
}

export function HeaderActions({
  requestId,
  canRequestRevision,
  isSlideReview,
  commentCount = 0,
  revisionCount,
  maxRevisions,
}: HeaderActionsProps) {
  const review = useReviewState();

  const revisionDisabled = isSlideReview
    ? !canRequestRevision || !(review?.state.hasSelections ?? false)
    : !canRequestRevision || commentCount === 0;

  const selectionsJson = review?.state.selectionsJson ?? "[]";

  const shotsMarkedCount = useMemo(() => {
    try {
      const selections = JSON.parse(selectionsJson) as StoryboardRevisionSelection[];
      return selections.length;
    } catch {
      return 0;
    }
  }, [selectionsJson]);

  return (
    <div className="flex items-center gap-6">
      <div className="hidden items-center gap-4 text-sm sm:flex">
        {isSlideReview && (
          <span className="text-muted-foreground">
            {shotsMarkedCount} shot{shotsMarkedCount === 1 ? "" : "s"} marked for changes
          </span>
        )}
        <span className="text-muted-foreground">
          Revisions used{" "}
          <span className="font-medium text-foreground">
            {revisionCount} / {maxRevisions}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {canRequestRevision && (
          <form action={requestStoryboardRevisionAction}>
            <input type="hidden" name="request_id" value={requestId} />
            {isSlideReview && (
              <input type="hidden" name="selections_json" value={selectionsJson} />
            )}
            <SubmitButton
              type="submit"
              variant="outline"
              size="sm"
              disabled={revisionDisabled}
              title={
                revisionDisabled
                  ? isSlideReview
                    ? "Select at least one change before requesting a revision."
                    : "Please add a comment before requesting a revision."
                  : undefined
              }
            >
              Request Revision
            </SubmitButton>
          </form>
        )}
        <form action={approveStoryboardAction}>
          <input type="hidden" name="request_id" value={requestId} />
          <SubmitButton type="submit" size="sm">
            Approve
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
