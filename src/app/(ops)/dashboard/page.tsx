import Link from "next/link";
import {
  PlusIcon,
  LayoutListIcon,
  CheckCircle2Icon,
  DownloadIcon,
  TriangleAlertIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
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
import { RequestRow } from "@/lib/types";

export default async function OpsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = (await searchParams) || {};
  const query = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "all";
  const { profile } = await getCurrentUserAndProfile();
  const supabase = await createClient();

  let requestQuery = supabase
    .from("requests")
    .select("*")
    .eq("company_id", profile.company_id!)
    .order("created_at", { ascending: false });

  if (query) {
    requestQuery = requestQuery.ilike("doctor_name", `%${query}%`);
  }
  if (status && status !== "all") {
    requestQuery = requestQuery.eq("status", status);
  }

  const { data: requests } = await requestQuery.returns<RequestRow[]>();

  const totalRequests = requests?.length ?? 0;
  const deliveredCount =
    requests?.filter((r) => r.status === "video_delivered").length ?? 0;
  const downloadedCount =
    requests?.filter((r) => Boolean(r.video_downloaded_at)).length ?? 0;
  const inReviewCount =
    requests?.filter(
      (r) => r.status === "storyboard_review" || r.status === "changes_requested",
    ).length ?? 0;
  const draftCount = requests?.filter((r) => r.status === "draft").length ?? 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-col gap-8">

        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
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

        {/* Metric cards */}
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

        {/* Requests table — search + filter unified in one form */}
        <Card>
          <CardHeader className="pb-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search doctors..."
                  defaultValue={query}
                  name="q"
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <SlidersHorizontalIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <select
                    name="status"
                    defaultValue={status}
                    className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[180px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="form_submitted">Form Submitted</option>
                    <option value="storyboard_in_progress">Storyboard In Progress</option>
                    <option value="storyboard_review">Storyboard Review</option>
                    <option value="changes_requested">Changes Requested</option>
                    <option value="storyboard_approved">Storyboard Approved</option>
                    <option value="video_in_progress">Video In Progress</option>
                    <option value="video_delivered">Video Delivered</option>
                  </select>
                </div>
                <Button variant="secondary" size="sm" type="submit" className="shrink-0">
                  Apply
                </Button>
              </div>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 md:pl-6">Doctor Name</TableHead>
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
                          <Link href={`/requests/${request.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!requests || requests.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
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
