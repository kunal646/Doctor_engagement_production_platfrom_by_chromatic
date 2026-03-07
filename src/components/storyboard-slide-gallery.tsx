"use client";

import { ReactNode, useState } from "react";

import { StoryboardSlideWithUrl } from "@/lib/storyboard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StoryboardSlideGalleryProps {
  slides: StoryboardSlideWithUrl[];
  renderFooter?: (slide: StoryboardSlideWithUrl) => ReactNode;
}

function SlideItem({
  slide,
  renderFooter,
}: {
  slide: StoryboardSlideWithUrl;
  renderFooter?: (slide: StoryboardSlideWithUrl) => ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <p className="mb-3 text-sm font-medium">{slide.label}</p>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted/20">
        <Skeleton
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-500",
            isLoaded ? "opacity-0 animate-none" : "opacity-100",
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.url}
          alt={slide.label}
          className={cn(
            "relative z-10 size-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
        />
      </div>
      {renderFooter ? <div className="mt-4">{renderFooter(slide)}</div> : null}
    </div>
  );
}

export function StoryboardSlideGallery({
  slides,
  renderFooter,
}: StoryboardSlideGalleryProps) {
  return (
    <div className="divide-y">
      {slides.map((slide) => (
        <SlideItem key={slide.path} slide={slide} renderFooter={renderFooter} />
      ))}
    </div>
  );
}
