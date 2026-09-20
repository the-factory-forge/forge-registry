"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { PreviewControls } from "@/showroom/preview-controls";

const subscribeReady = () => () => {};

/** Demos supply content and controls; this frame owns preview chrome and geometry. */
export function ShowroomPreview({
  children,
  controls,
  navigation,
  width = "standard",
}: {
  children: ReactNode;
  controls?: ReactNode;
  navigation?: ReactNode;
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
        <PreviewControls navigation={navigation}>{controls}</PreviewControls>
      )}
      <Content
        id="showroom-preview"
        tabIndex={-1}
        aria-label="Component preview"
        className="showroom-stage focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </Content>
    </div>
  );
}
