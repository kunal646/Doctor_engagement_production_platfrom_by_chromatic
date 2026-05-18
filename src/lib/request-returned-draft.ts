import type { RequestRow } from "@/lib/types";

export function isReturnedForEditsRequest(
  request: Pick<RequestRow, "status" | "admin_rejection_reason">,
): boolean {
  return (
    request.status === "draft" &&
    Boolean(String(request.admin_rejection_reason ?? "").trim())
  );
}

/** Puts admin-returned drafts first; then newest by submit/created time. */
export function sortOpsDashboardRequests(requests: RequestRow[]): RequestRow[] {
  return [...requests].sort((a, b) => {
    const ar = isReturnedForEditsRequest(a);
    const br = isReturnedForEditsRequest(b);
    if (ar !== br) {
      return ar ? -1 : 1;
    }
    const at = new Date(a.form_submitted_at ?? a.created_at).getTime();
    const bt = new Date(b.form_submitted_at ?? b.created_at).getTime();
    return bt - at;
  });
}
