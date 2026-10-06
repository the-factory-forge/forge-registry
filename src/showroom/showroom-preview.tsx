"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { PreviewControls } from "@/showroom/preview-controls";

const subscribeReady = () => () => {};

export const previewDataNotice = "This example uses sample data. Changes reset when you reload.";

export function ShowroomIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="mb-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{children}</p>
    </header>
  );
}

/** Demos supply content and controls; this frame owns preview chrome and geometry. */
export function ShowroomPreview({
  children,
  controls,
  navigation,
  notice,
  width = "standard",
}: {
  children: ReactNode;
  controls?: ReactNode;
  navigation?: ReactNode;
  notice?: ReactNode;
  width?: "standard" | "narrow" | "full";
}) {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  // Full-page examples already supply their own main landmark.
  const Content = width === "full" ? "div" : "main";
  return (
    <div
      className="showroom-frame"
      data-width={width}
      data-has-controls={Boolean(controls || navigation)}
      data-preview-ready={ready}
    >
      {(controls || navigation) && (
        <PreviewControls navigation={navigation} notice={notice}>
          {controls}
        </PreviewControls>
      )}
      <Content
        id="factory-showroom-preview"
        tabIndex={-1}
        aria-label="Component preview"
        className="showroom-stage focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </Content>
    </div>
  );
}
