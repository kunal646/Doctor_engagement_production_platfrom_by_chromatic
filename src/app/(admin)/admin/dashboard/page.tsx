import Link from "next/link";
import {
  LayoutListIcon,
  CheckCircle2Icon,
  DownloadIcon,
  TriangleAlertIcon,
  SlidersHorizontalIcon,
  BuildingIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
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
import { RequestRow } from "@/lib/types";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; company?: string }>;
}) {
  const params = (await searchParams) || {};
  const status = params.status?.trim() ?? "all";
  const companyFilter = params.company?.trim() ?? "all";

  const supabase = await createClient();

  let requestQuery = supabase
    .from("requests")
    .select("*, companies(name)")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    requestQuery = requestQuery.eq("status", status);
  }
  if (companyFilter && companyFilter !== "all") {
    requestQuery = requestQuery.eq("company_id", companyFilter);
  }

  const { data: requests } = await requestQuery.returns<
    (RequestRow & { companies: { name: string } | null })[]
  >();

  const { data: companies } = await supabase
    .from("companies")
    .select("id,name")
    .order("name", { ascending: true });

  const totalRequests = requests?.length ?? 0;
  const deliveredCount =
    requests?.filter((item) => item.status === "video_delivered").length ?? 0;
  const downloadedCount =
    requests?.filter((item) => Boolean(item.video_downloaded_at)).length ?? 0;
  const pendingCount =
    requests?.filter((item) => item.status !== "video_delivered").length ?? 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-col gap-8">

        {/* Page header */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Monitor production pipeline across all client companies.
          </p>
        </div>

        {/* Metric cards */}
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

        {/* Requests table */}
        <Card>
          <CardHeader className="pb-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 sm:max-w-[200px]">
                  <BuildingIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <select
                    name="company"
                    defaultValue={companyFilter}
                    className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">All Companies</option>
                    {(companies ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-1 sm:max-w-[180px]">
                  <SlidersHorizontalIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <select
                    name="status"
                    defaultValue={status}
                    className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              </div>
              <Button variant="secondary" size="sm" type="submit" className="w-full shrink-0 sm:w-auto">
                Apply Filters
              </Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 md:pl-6">Doctor</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Downloaded</TableHead>
                    <TableHead className="hidden md:table-cell">Submitted</TableHead>
                    <TableHead className="pr-4 text-right md:pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requests ?? []).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="pl-4 font-medium md:pl-6">
                        {request.doctor_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.companies?.name ?? "-"}
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
                        {new Date(request.created_at).toLocaleDateString()}
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
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No requests found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
