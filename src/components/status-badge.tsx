import {
  ClipboardIcon,
  PenLineIcon,
  EyeIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
  ClapperboardIcon,
  PackageCheckIcon,
} from "lucide-react";

import { STATUS_LABELS } from "@/lib/constants";
import { RequestStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  RequestStatus,
  { className: string; Icon: React.ElementType }
> = {
  form_submitted: {
    className: "border-border bg-muted text-muted-foreground",
    Icon: ClipboardIcon,
  },
  storyboard_in_progress: {
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
    Icon: PenLineIcon,
  },
  storyboard_review: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Icon: EyeIcon,
  },
  changes_requested: {
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: RotateCcwIcon,
  },
  storyboard_approved: {
    className:
      "border-success/30 bg-success/10 text-success",
    Icon: CheckCircle2Icon,
  },
  video_in_progress: {
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
    Icon: ClapperboardIcon,
  },
  video_delivered: {
    className: "border-success/40 bg-success/15 text-success",
    Icon: PackageCheckIcon,
  },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { className, Icon } = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px] font-medium", className)}
    >
      <Icon className="size-3 shrink-0" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
