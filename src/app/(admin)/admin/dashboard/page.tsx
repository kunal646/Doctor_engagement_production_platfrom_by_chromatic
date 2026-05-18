import Link from "next/link";
import { Suspense } from "react";
import {
  LayoutListIcon,
  CheckCircle2Icon,
  DownloadIcon,
  TriangleAlertIcon,
  SlidersHorizontalIcon,
  BuildingIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { profileDisplayName } from "@/lib/profile-display";
import { requestSubmittedListMeta } from "@/lib/request-submitted-at";
import { RequestRow } from "@/lib/types";

const selectClassName =
  "h-11 w-full rounded-sm border border-input bg-background px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

type AdminRequestWithRelations = RequestRow & {
  companies: { name: string } | null;
  submitted_by: { full_name: string | null; email: string | null } | null;
};

async function AdminRequestsTable({
  status,
  companyFilter,
}: {
  status: string;
  companyFilter: string;
}) {
  const supabase = await createClient();

  let requestQuery = supabase
    .from("requests")
    .select(
      "*, companies(name), submitted_by:profiles!requests_created_by_fkey(full_name,email)",
    )
    .neq("status", "draft")
    .order("form_submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    requestQuery = requestQuery.eq("status", status);
  }
  if (companyFilter && companyFilter !== "all") {
    requestQuery = requestQuery.eq("company_id", companyFilter);
  }

  const { data: requests } = await requestQuery.returns<AdminRequestWithRelations[]>();

  return (
    <CardContent className="px-0 pt-4">
      <div className="space-y-3 px-5 md:hidden">
        {(requests ?? []).map((request) => (
          <Link
            key={request.id}
            href={`/admin/requests/${request.id}`}
            className="block rounded-sm border bg-background p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{request.doctor_name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  {request.companies?.name ?? "Unknown Company"}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Submitted by {profileDisplayName(request.submitted_by)}
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
              <TableHead className="pl-4 md:pl-6">Doctor</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="hidden lg:table-cell">Submitted by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Downloaded</TableHead>
              <TableHead className="hidden md:table-cell">Submitted</TableHead>
              <TableHead className="pr-4 text-right md:pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(requests ?? []).map((request) => (
              <TableRow key={request.id}>
                <TableCell className="pl-4 font-medium md:pl-6">{request.doctor_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {request.companies?.name ?? "-"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {profileDisplayName(request.submitted_by)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {request.video_downloaded_at
                    ? new Date(request.video_downloaded_at).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {requestSubmittedListMeta(request).dateLabel}
                </TableCell>
                <TableCell className="pr-4 text-right md:pr-6">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/requests/${request.id}`}>Manage</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; company?: string }>;
}) {
  const params = (await searchParams) || {};
  const status = params.status?.trim() ?? "all";
  const companyFilter = params.company?.trim() ?? "all";

  const supabase = await createClient();

  const { data: summaryRequests } = await supabase
    .from("requests")
    .select("status,video_downloaded_at")
    .neq("status", "draft")
    .returns<Pick<RequestRow, "status" | "video_downloaded_at">[]>();

  const { data: companies } = await supabase
    .from("companies")
    .select("id,name")
    .order("name", { ascending: true });

  const totalRequests = summaryRequests?.length ?? 0;
  const deliveredCount =
    summaryRequests?.filter((item) => item.status === "video_delivered").length ?? 0;
  const downloadedCount =
    summaryRequests?.filter((item) => Boolean(item.video_downloaded_at)).length ?? 0;
  const pendingCount =
    summaryRequests?.filter((item) => item.status !== "video_delivered").length ?? 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8 lg:px-8">
      <RealtimeRefresh topics={["dashboard:admin"]} />
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="border-b pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Admin Workspace
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Admin Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor production pipeline across all client companies.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <LayoutListIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalRequests}</div>
              <p className="text-xs text-muted-foreground">Requests across all companies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Pipeline</CardTitle>
              <TriangleAlertIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Pending or in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle2Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{deliveredCount}</div>
              <p className="text-xs text-muted-foreground">Completed videos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Downloaded</CardTitle>
              <DownloadIcon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{downloadedCount}</div>
              <p className="text-xs text-muted-foreground">Videos downloaded at least once</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4 pb-0">
            <div>
              <CardTitle className="text-base">Requests</CardTitle>
              <p className="text-sm text-muted-foreground">
                Filter company activity and review requests across the pipeline.
              </p>
            </div>
            <DashboardFilterForm
              className="grid gap-3 md:grid-cols-[220px_220px_auto] md:items-center"
              submitLabel="Apply Filters"
              submitButtonClassName="w-full md:w-auto"
            >
              <div className="relative">
                <BuildingIcon className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <select
                  name="company"
                  defaultValue={companyFilter}
                  className={`${selectClassName} appearance-none pl-10`}
                >
                  <option value="all">All Companies</option>
                  {(companies ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <SlidersHorizontalIcon className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <select
                  name="status"
                  defaultValue={status}
                  className={`${selectClassName} appearance-none pl-10`}
                >
                  <option value="all">All Statuses</option>
                  <option value="form_submitted">Form Submitted</option>
                  <option value="storyboard_in_progress">Storyboard In Progress</option>
                  <option value="storyboard_review">Storyboard Review</option>
                  <option value="changes_requested">Changes Requested</option>
                  <option value="storyboard_approved">Storyboard Approved</option>
                  <option value="video_in_progress">Video In Progress</option>
                  <option value="video_delivered">Video Delivered</option>
                </select>
              </div>
            </DashboardFilterForm>
          </CardHeader>
          <Suspense
            key={`${companyFilter}:${status}`}
            fallback={
              <CardContent className="px-5 py-10 text-sm text-muted-foreground">
                Loading requests...
              </CardContent>
            }
          >
            <AdminRequestsTable status={status} companyFilter={companyFilter} />
          </Suspense>
        </Card>
      </div>
    </section>
  );
}
