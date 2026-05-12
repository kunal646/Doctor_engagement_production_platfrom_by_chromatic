"use client";

import { useState } from "react";
import { CheckIcon, ClipboardIcon, Maximize2Icon, XIcon } from "lucide-react";

import { JsonRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function JsonCopyPanel({ data }: { data: JsonRecord }) {
  const [copied, setCopied] = useState(false);
  const [pretty, setPretty] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);

  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request JSON</CardTitle>
        <CardAction>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setFullScreen(true)}
            >
              <Maximize2Icon /> Full Preview
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPretty((v) => !v)}
            >
              {pretty ? "Compact" : "Pretty"}
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={async () => {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <>
                  <CheckIcon /> Copied
                </>
              ) : (
                <>
                  <ClipboardIcon /> Copy
                </>
              )}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
          {content}
        </pre>
      </CardContent>
      {fullScreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Full JSON Preview</p>
              <p className="text-xs text-muted-foreground">
                Showing the same request JSON from this panel.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <>
                    <CheckIcon className="size-4" /> Copied
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="size-4" /> Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setFullScreen(false)}
                aria-label="Close full JSON preview"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <pre className="min-h-full whitespace-pre-wrap wrap-break-word rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
              {content}
            </pre>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
