import type { RequestRow } from "@/lib/types";

/** Timestamp to show as “submitted” (real submit time, with legacy fallback). */
export function getRequestFormSubmittedAtIso(
  request: Pick<RequestRow, "form_submitted_at" | "created_at">,
): string {
  return request.form_submitted_at ?? request.created_at;
}

/** Dashboard list: label + formatted date so drafts show “Created”, pipeline shows “Submitted”. */
export function requestSubmittedListMeta(
  request: Pick<RequestRow, "form_submitted_at" | "created_at" | "status">,
): { label: string; dateLabel: string } {
  if (request.status === "draft") {
    return {
      label: "Created",
      dateLabel: new Date(request.created_at).toLocaleDateString(),
    };
  }
  return {
    label: "Submitted",
    dateLabel: new Date(getRequestFormSubmittedAtIso(request)).toLocaleDateString(),
  };
}

export function requestSubmittedDetailRow(
  request: Pick<RequestRow, "form_submitted_at" | "created_at" | "status">,
): { label: string; value: string } {
  if (request.status === "draft") {
    return {
      label: "Draft started",
      value: new Date(request.created_at).toLocaleString(),
    };
  }
  return {
    label: "Intake submitted",
    value: new Date(getRequestFormSubmittedAtIso(request)).toLocaleString(),
  };
}

/** Admin metadata: show stored submit time, or legacy fallback, or draft message. */
export function intakeSubmittedDisplayValue(
  request: Pick<RequestRow, "form_submitted_at" | "created_at" | "status">,
): string {
  if (request.form_submitted_at) {
    return new Date(request.form_submitted_at).toLocaleString();
  }
  if (request.status === "draft") {
    return "Not yet (draft)";
  }
  return new Date(request.created_at).toLocaleString();
}
