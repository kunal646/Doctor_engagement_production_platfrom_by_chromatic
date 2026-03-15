import { RequestStatus } from "@/lib/types";

export const REQUEST_STATUSES: RequestStatus[] = [
  "draft",
  "form_submitted",
  "storyboard_in_progress",
  "storyboard_review",
  "changes_requested",
  "storyboard_approved",
  "video_in_progress",
  "video_delivered",
];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  form_submitted: "Form Submitted",
  storyboard_in_progress: "Storyboard In Progress",
  storyboard_review: "Storyboard Review",
  changes_requested: "Changes Requested",
  storyboard_approved: "Storyboard Approved",
  video_in_progress: "Video In Progress",
  video_delivered: "Video Delivered",
};

export const STATUS_OPTIONS = REQUEST_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));
