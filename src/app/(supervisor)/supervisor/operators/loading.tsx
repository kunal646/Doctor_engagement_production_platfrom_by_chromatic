import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export default function OperatorsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 md:px-6">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b px-4 py-3 last:border-0 md:px-6">
              <div className="grid grid-cols-6 items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mx-auto h-4 w-8" />
                <Skeleton className="mx-auto h-4 w-8" />
                <Skeleton className="mx-auto h-4 w-8" />
                <Skeleton className="ml-auto h-7 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
