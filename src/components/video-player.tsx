"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VideoPlayer({
  url,
  requestId,
  initialDownloaded = false,
}: {
  url: string;
  requestId: string;
  initialDownloaded?: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(initialDownloaded);

  async function handleDownload() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to download video.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "doctor-engagement-video.mp4";

      const trackingResponse = await fetch("/api/videos/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });
      if (!trackingResponse.ok) {
        throw new Error("Failed to record video download.");
      }

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setIsDownloaded(true);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Failed to download video.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <video controls className="w-full">
          <source src={url} />
          Your browser does not support video playback.
        </video>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <DownloadIcon className="mr-2 size-4" />
          {isDownloading ? "Downloading..." : isDownloaded ? "Download Again" : "Download Video"}
        </Button>
      </div>
    </div>
  );
}
