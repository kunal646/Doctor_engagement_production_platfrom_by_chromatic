import Link from "next/link";
import { Suspense } from "react";
import {
  PlusIcon,
  LayoutListIcon,
  CheckCircle2Icon,
  DownloadIcon,
  TriangleAlertIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  ChevronRightIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { DashboardFilterForm } from "@/components/dashboard-filter-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestSubmittedListMeta } from "@/lib/request-submitted-at";
import { RequestRow } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "form_submitted", label: "Form Submitted" },
  { value: "storyboard_in_progress", label: "Storyboard In Progress" },
  { value: "storyboard_review", label: "Storyboard Review" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "storyboard_approved", label: "Storyboard Approved" },
  { value: "video_in_progress", label: "Video In Progress" },
  { value: "video_delivered", label: "Video Delivered" },
];

const selectClassName =
  "h-11 w-full rounded-sm border border-input bg-background px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

async function OpsRequestsTable({
  companyId,
  query,
  status,
}: {
  companyId: string;
  query: string;
  status: string;
}) {
  const supabase = await createClient();

  let requestQuery = supabase
    .from("requests")
    .select("*")
    .eq("company_id", companyId)
    .order("form_submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (query) {
    requestQuery = requestQuery.ilike("doctor_name", `%${query}%`);
  }
  if (status && status !== "all") {
    requestQuery = requestQuery.eq("status", status);
  }

  const { data: requests } = await requestQuery.returns<RequestRow[]>();

  return (
    <CardContent className="px-0 pt-4">
      <div className="space-y-3 px-5 md:hidden">
        {(requests ?? []).map((request) => (
          <Link
            key={request.id}
            href={`/requests/${request.id}`}
            className="block rounded-sm border bg-background p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{request.doctor_name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  {(() => {
                    const meta = requestSubmittedListMeta(request);
                    return `${meta.label} ${meta.dateLabel}`;
                  })()}
                </p>
              </div>
              <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              <span className="text-xs text-muted-foreground">
                {request.video_downloaded_at
                  ? `Downloaded ${new Date(request.video_downloaded_at).toLocaleDateString()}`
                  : "Not downloaded yet"}
              </span>
            </div>
          </Link>
        ))}
        {(!requests || requests.length === 0) && (
          <div className="rounded-sm border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No requests found.
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 md:pl-6">Doctor Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Downloaded</TableHead>
              <TableHead className="hidden md:table-cell">Created / submitted</TableHead>
              <TableHead className="pr-4 text-right md:pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests ?? []).map((request) => (
              <TableRow key={request.id}>
                <TableCell className="pl-4 font-medium md:pl-6">{request.doctor_name}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {request.video_downloaded_at
                    ? new Date(request.video_downloaded_at).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {(() => {
                    const meta = requestSubmittedListMeta(request);
                    return `${meta.label} ${meta.dateLabel}`;
                  })()}
                </TableCell>
                <TableCell className="pr-4 text-right md:pr-6">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/requests/${request.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  );
}

export default async function OpsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = (await searchParams) || {};
  const query = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "all";
  const { profile, userId } = await getCurrentUserAndProfile();
  const supabase = await createClient();

  const { data: summaryRequests } = await supabase
    .from("requests")
    .select("status,video_downloaded_at")
    .eq("company_id", profile.company_id!)
    .returns<Pick<RequestRow, "status" | "video_downloaded_at">[]>();

  const totalRequests = summaryRequests?.length ?? 0;
  const deliveredCount =
    summaryRequests?.filter((r) => r.status === "video_delivered").length ?? 0;
  const downloadedCount =
    summaryRequests?.filter((r) => Boolean(r.video_downloaded_at)).length ?? 0;
  const inReviewCount =
    summaryRequests?.filter(
      (r) => r.status === "storyboard_review" || r.status === "changes_requested",
    ).length ?? 0;
  const draftCount =
    summaryRequests?.filter((r) => r.status === "draft").length ?? 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8 lg:px-8">
      <RealtimeRefresh topics={[`user:${userId}`]} />
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ops Workspace
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Overview of your doctor engagement pipeline.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/requests/new">
              <PlusIcon className="mr-2 size-4" />
              New Request
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <LayoutListIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalRequests}</div>
              <p className="text-xs text-muted-foreground">
                Including {draftCount} draft{draftCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
              <TriangleAlertIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{inReviewCount}</div>
              <p className="text-xs text-muted-foreground">In review or changes requested</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Videos Delivered</CardTitle>
              <CheckCircle2Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{deliveredCount}</div>
              <p className="text-xs text-muted-foreground">Completed deliveries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Videos Downloaded</CardTitle>
              <DownloadIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{downloadedCount}</div>
              <p className="text-xs text-muted-foreground">Downloaded at least once</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4 pb-0">
            <div>
              <CardTitle className="text-base">Requests</CardTitle>
              <p className="text-sm text-muted-foreground">
                Search and review recent doctor requests.
              </p>
            </div>
            <DashboardFilterForm
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center"
              submitButtonClassName="w-full md:w-auto"
            >
              <div className="relative">
                <SearchIcon className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search doctors..."
                  defaultValue={query}
                  name="q"
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <SlidersHorizontalIcon className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <select
                  name="status"
                  defaultValue={status}
                  className={`${selectClassName} appearance-none pl-10`}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </DashboardFilterForm>
          </CardHeader>
          <Suspense
            key={`${query}:${status}`}
            fallback={
              <CardContent className="px-5 py-10 text-sm text-muted-foreground">
                Loading requests...
              </CardContent>
            }
          >
            <OpsRequestsTable
              companyId={profile.company_id!}
              query={query}
              status={status}
            />
          </Suspense>
        </Card>

      </div>
    </section>
  );
}
