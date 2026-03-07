import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function SupervisorRequestDetailLoading() {
  return (
    <div className="flex flex-col">

      <div className="border-b px-4 py-3 md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">

          <div className="flex flex-col lg:col-span-2">
            <section className="pb-6">
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="divide-y">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="py-5 first:pt-0">
                    <Skeleton className="mb-3 h-4 w-14" />
                    <Skeleton className="h-52 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <Separator className="mt-6" />
            </section>

            <section className="pt-2">
              <Skeleton className="mb-4 h-4 w-20" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Separator />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
