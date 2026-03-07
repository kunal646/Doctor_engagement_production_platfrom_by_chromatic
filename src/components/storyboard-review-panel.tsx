"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  getStoryboardIssueLabel,
  STORYBOARD_ISSUES,
  StoryboardIssue,
  StoryboardSlideWithUrl,
} from "@/lib/storyboard";
import { useReviewState } from "@/components/review-context";
import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StoryboardReviewPanelProps {
  slides: StoryboardSlideWithUrl[];
}

export function StoryboardReviewPanel({
  slides,
}: StoryboardReviewPanelProps) {
  const [selectedByOrder, setSelectedByOrder] = useState<Record<number, StoryboardIssue[]>>({});
  const review = useReviewState();
  const updateReview = review?.update;

  const hasSelections = useMemo(
    () => Object.values(selectedByOrder).some((issues) => issues.length > 0),
    [selectedByOrder],
  );

  const selectedShotCount = useMemo(
    () => Object.values(selectedByOrder).filter((issues) => issues.length > 0).length,
    [selectedByOrder],
  );

  const selectionsJson = useMemo(
    () =>
      JSON.stringify(
        slides
          .map((slide) => ({
            order: slide.order,
            issues: selectedByOrder[slide.order] ?? [],
          }))
          .filter((selection) => selection.issues.length > 0),
      ),
    [selectedByOrder, slides],
  );

  useEffect(() => {
    updateReview?.({ selectionsJson, hasSelections });
  }, [selectionsJson, hasSelections, updateReview]);

  function approveShot(order: number) {
    setSelectedByOrder((current) => {
      const next = { ...current };
      delete next[order];
      return next;
    });
  }

  function toggleIssue(order: number, issue: StoryboardIssue) {
    setSelectedByOrder((current) => {
      const existing = current[order] ?? [];
      const nextIssues = existing.includes(issue)
        ? existing.filter((value) => value !== issue)
        : [...existing, issue];

      if (nextIssues.length === 0) {
        const nextState = { ...current };
        delete nextState[order];
        return nextState;
      }

      return {
        ...current,
        [order]: nextIssues,
      };
    });
  }

  return (
    <div className="space-y-4">
      <StoryboardSlideGallery
        slides={slides}
        renderFooter={(slide) => {
          const selectedIssues = selectedByOrder[slide.order] ?? [];
          const hasRevisions = selectedIssues.length > 0;

          return (
            <div className="space-y-3">
              <p className="text-sm font-medium">Shot actions</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={hasRevisions ? "outline" : "default"}
                  onClick={() => approveShot(slide.order)}
                >
                  Approve
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={hasRevisions ? "default" : "outline"}
                      className="gap-1"
                    >
                      Request Revision
                      <ChevronDownIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STORYBOARD_ISSUES.map((issue) => {
                      const isSelected = selectedIssues.includes(issue);
                      return (
                        <DropdownMenuCheckboxItem
                          key={issue}
                          checked={isSelected}
                          onCheckedChange={() => toggleIssue(slide.order, issue)}
                        >
                          {getStoryboardIssueLabel(issue)}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {hasRevisions && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedIssues.map(getStoryboardIssueLabel).join(", ")}
                </p>
              )}
            </div>
          );
        }}
      />

      {selectedShotCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedShotCount} shot{selectedShotCount === 1 ? "" : "s"} marked for changes
        </p>
      )}
    </div>
  );
}
