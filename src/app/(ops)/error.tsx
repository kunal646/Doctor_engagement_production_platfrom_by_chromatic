"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OpsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircleIcon className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. You can try again or go back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-2">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCwIcon className="mr-2 size-4" />
          Try again
        </Button>
        <Button size="sm" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
