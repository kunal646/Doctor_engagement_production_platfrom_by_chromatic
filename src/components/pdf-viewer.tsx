import { FileTextIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfViewer({
  url,
  title = "Storyboard PDF",
}: {
  url: string;
  title?: string;
}) {
  return (
    <div className="space-y-2">
      {/* Desktop: inline iframe viewer */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <iframe
          title={title}
          src={url}
          className="h-[560px] w-full"
          loading="lazy"
        />
      </div>

      {/* Desktop: open in new tab link */}
      <div className="hidden md:flex md:justify-end">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="mr-1.5 size-3.5" />
            Open in new tab
          </a>
        </Button>
      </div>

      {/* Mobile: PDF cannot be shown inline on iOS Safari — show open button instead */}
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-8 text-center md:hidden">
        <div className="rounded-full bg-muted p-4">
          <FileTextIcon className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            Tap to open and view the full storyboard PDF
          </p>
        </div>
        <Button asChild size="default" className="w-full max-w-[200px]">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="mr-2 size-4" />
            View PDF
          </a>
        </Button>
      </div>
    </div>
  );
}
