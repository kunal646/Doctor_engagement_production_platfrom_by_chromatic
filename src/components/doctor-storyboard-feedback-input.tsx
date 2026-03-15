"use client";

import { useMemo, useState } from "react";

import { StoryboardSlideGallery } from "@/components/storyboard-slide-gallery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StoryboardSlideWithUrl } from "@/lib/storyboard";

interface DoctorStoryboardFeedbackInputProps {
  slides: StoryboardSlideWithUrl[];
}

export function DoctorStoryboardFeedbackInput({
  slides,
}: DoctorStoryboardFeedbackInputProps) {
  const [commentsByOrder, setCommentsByOrder] = useState<Record<number, string>>({});

  const selectionsJson = useMemo(
    () =>
      JSON.stringify(
        slides
          .map((slide) => ({
            order: slide.order,
            comment: commentsByOrder[slide.order]?.trim() ?? "",
          }))
          .filter((selection) => selection.comment.length > 0),
      ),
    [commentsByOrder, slides],
  );

  function clearComment(order: number) {
    setCommentsByOrder((current) => {
      const next = { ...current };
      delete next[order];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="selections_json" value={selectionsJson} />
      <StoryboardSlideGallery
        slides={slides}
        renderFooter={(slide) => {
          const comment = commentsByOrder[slide.order] ?? "";
          const hasFeedback = comment.trim().length > 0;

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Feedback for this shot</p>
                {hasFeedback ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-auto px-0 text-xs"
                    onClick={() => clearComment(slide.order)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              <Textarea
                value={comment}
                onChange={(event) =>
                  setCommentsByOrder((current) => ({
                    ...current,
                    [slide.order]: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Add the exact change needed for this shot. Leave blank if this shot is approved."
              />
            </div>
          );
        }}
      />
    </div>
  );
}
