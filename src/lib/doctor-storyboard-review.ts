import { StoryboardRevisionSelection, StoryboardSlide } from "@/lib/storyboard";
import {
  DoctorStoryboardReviewSessionRow,
} from "@/lib/types";

import {
  buildDoctorReviewLink,
  DOCTOR_REVIEW_LINK_TTL_HOURS,
  generateDoctorReviewToken,
  getRequestBaseUrl,
  hashDoctorReviewToken,
  isDoctorReviewExpired,
} from "@/lib/doctor-review";

export {
  buildDoctorReviewLink,
  DOCTOR_REVIEW_LINK_TTL_HOURS,
  generateDoctorReviewToken,
  getRequestBaseUrl,
  hashDoctorReviewToken,
  isDoctorReviewExpired,
};

export function parseStoryboardReviewSelections(rawValue: string) {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("Invalid storyboard review payload.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid storyboard review payload.");
  }

  const selections: StoryboardRevisionSelection[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid storyboard review payload.");
    }

    const maybeOrder = "order" in item ? item.order : undefined;
    const maybeComment = "comment" in item ? item.comment : undefined;

    if (
      typeof maybeOrder !== "number" ||
      !Number.isInteger(maybeOrder) ||
      maybeOrder <= 0 ||
      typeof maybeComment !== "string"
    ) {
      throw new Error("Invalid storyboard review payload.");
    }

    const comment = maybeComment.trim();
    if (comment) {
      selections.push({
        order: maybeOrder,
        comment,
      });
    }
  }

  return selections;
}

export function validateStoryboardSelectionsAgainstSlides(
  selections: StoryboardRevisionSelection[],
  slides: StoryboardSlide[] | null,
) {
  const validOrders = new Set((slides ?? []).map((slide) => slide.order));
  return selections.every((selection) => validOrders.has(selection.order));
}

export function buildDoctorStoryboardReviewSummary(
  decision: "approve" | "changes_requested",
  overallComment: string,
  selections: StoryboardRevisionSelection[],
) {
  const lines: string[] = [];

  if (decision === "approve") {
    lines.push("Doctor approved the storyboard.");
  } else {
    lines.push("Doctor requested storyboard changes.");
  }

  const trimmedComment = overallComment.trim();
  if (trimmedComment) {
    lines.push("", "Overall feedback:", trimmedComment);
  }

  if (selections.length > 0) {
    lines.push("", "Shot-specific feedback:", "");
    for (const selection of selections.sort((a, b) => a.order - b.order)) {
      lines.push(`Shot ${selection.order}`, selection.comment, "");
    }
  }

  return lines.join("\n").trim();
}

export function countDoctorStoryboardReviewFeedback(
  session: Pick<
    DoctorStoryboardReviewSessionRow,
    "submitted_comment" | "submitted_selections"
  >,
) {
  return (
    (session.submitted_comment?.trim() ? 1 : 0) +
    (session.submitted_selections?.filter((selection) => selection.comment.trim()).length ?? 0)
  );
}
