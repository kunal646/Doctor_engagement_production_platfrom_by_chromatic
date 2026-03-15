export interface StoryboardSlide {
  order: number;
  path: string;
  label: string;
}

export interface StoryboardSlideWithUrl extends StoryboardSlide {
  url: string;
}

export interface StoryboardRevisionSelection {
  order: number;
  comment: string;
}

export function buildStoryboardRevisionSummary(
  selections: StoryboardRevisionSelection[],
) {
  const normalizedSelections = selections
    .map((selection) => ({
      order: selection.order,
      comment: selection.comment.trim(),
    }))
    .filter((selection) => selection.comment.length > 0)
    .sort((a, b) => a.order - b.order);

  if (normalizedSelections.length === 0) {
    return "";
  }

  return [
    "Requested storyboard changes:",
    "",
    ...normalizedSelections.flatMap((selection) => [
      `Shot ${selection.order}`,
      selection.comment,
      "",
    ]),
  ]
    .join("\n")
    .trim();
}
