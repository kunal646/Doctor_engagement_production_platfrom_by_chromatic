import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-col gap-8">

        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-full sm:w-32" />
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="size-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Requests table card */}
        <Card>
          <CardHeader className="pb-4">
            {/* Search + filter toolbar skeleton */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Skeleton className="h-10 flex-1" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 sm:w-44 sm:flex-none" />
                <Skeleton className="h-10 w-16 shrink-0" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="border-b px-4 py-3 md:px-6">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </div>
            </div>
            {/* Table rows */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border-b px-4 py-3 last:border-0 md:px-6">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="hidden h-4 w-20 md:block" />
                  <Skeleton className="ml-auto h-7 w-12" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </section>
  );
}
