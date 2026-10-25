"use client";

import { useLocation, useNavigate } from "@tanstack/react-router";
import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { previewDeviceSearch, previewLocationMessage } from "@/showroom/preview-device";
import { applyTheme, useShowroomTheme } from "@/showroom/theme-control";

const subscribeReady = () => () => {};

export function useEmbeddedPreview() {
  const location = useLocation();
  const { previewEmbed } = previewDeviceSearch.parse(location.search);
  return useSyncExternalStore(
    subscribeReady,
    () => window.parent !== window && window.name === "factory-device-preview",
    () => previewEmbed ?? false,
  );
}

function subscribeViewport(onChange: () => void) {
  const query = window.matchMedia("(min-width: 40rem)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function DeviceControl() {
  const location = useLocation();
  const navigate = useNavigate();
  const { previewDevice, previewEmbed } = previewDeviceSearch.parse(location.search);
  if (previewEmbed) return null;

  const Icon =
    previewDevice === "phone"
      ? SmartphoneIcon
      : previewDevice === "tablet"
        ? TabletIcon
        : LaptopIcon;
  const nextDevice =
    previewDevice === "phone" ? "tablet" : previewDevice === "tablet" ? undefined : "phone";
  const label =
    previewDevice === "phone"
      ? "Small preview — switch to medium"
      : previewDevice === "tablet"
        ? "Medium preview — switch to big"
        : "Big preview — switch to small";

  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          const url = new URL(location.href, window.location.origin);
          if (nextDevice) url.searchParams.set("previewDevice", nextDevice);
          else url.searchParams.delete("previewDevice");
          void navigate({ href: url.pathname + url.search + url.hash, resetScroll: false });
        }}
        className={cn(
          "hidden size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex",
          previewDevice
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
      </button>
    </IconTooltip>
  );
}

export function ShowroomViewport({ children }: { children: ReactNode }) {
  const theme = useShowroomTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { previewDevice } = previewDeviceSearch.parse(location.search);
  const previewEmbed = useEmbeddedPreview();
  const wide = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia("(min-width: 40rem)").matches,
    () => false,
  );

  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!previewEmbed) return;
    function onMessage(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = previewLocationMessage.safeParse(event.data);
      if (!message.success) return;
      const url = new URL(message.data.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      void navigate({
        href: url.pathname + url.search + url.hash,
        replace: true,
        resetScroll: false,
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, previewEmbed]);

  useEffect(() => {
    if (previewEmbed && window.parent !== window) {
      window.parent.postMessage(
        { type: "showroom-preview-location", href: location.href },
        window.location.origin,
      );
    }
  }, [location.href, previewEmbed]);

  if (previewEmbed || !ready) {
    return <div data-showroom-embedded={previewEmbed || undefined}>{children}</div>;
  }
  const url = new URL(location.href, "https://showroom.invalid");
  url.searchParams.delete("previewDevice");
  return (
    <DeviceFrame
      theme={theme}
      href={url.pathname + url.search + url.hash}
      device={wide ? previewDevice : undefined}
    />
  );
}

function DeviceFrame({
  href,
  device,
  theme,
}: {
  href: string;
  device: "phone" | "tablet" | undefined;
  theme: "light" | "dark";
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const reflectedLocations = useRef(new Set<string>());
  const [initialHref] = useState(() => {
    const url = new URL(href, "https://showroom.invalid");
    url.searchParams.set("previewEmbed", "true");
    return url.pathname + url.search + url.hash;
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (frame.current?.contentDocument) applyTheme(theme, frame.current.contentDocument);
  }, [theme]);

  useEffect(() => {
    // A delayed shell update must not send an older filter back into the preview.
    if (reflectedLocations.current.has(href)) {
      for (const reflected of reflectedLocations.current) {
        reflectedLocations.current.delete(reflected);
        if (reflected === href) break;
      }
      return;
    }
    const target = frame.current?.contentWindow;
    if (!target || target.location.href === "about:blank") return;
    const current = new URL(target.location.href);
    current.searchParams.delete("previewEmbed");
    // Navigate within the existing React tree; device changes only resize the iframe.
    if (current.pathname + current.search + current.hash !== href) {
      target.postMessage({ type: "showroom-preview-location", href }, window.location.origin);
    }
  }, [href]);

  useEffect(() => {
    function onMessage(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      const message = previewLocationMessage.safeParse(event.data);
      if (!message.success) return;
      const url = new URL(message.data.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      url.searchParams.delete("previewEmbed");
      const reflected = url.pathname + url.search + url.hash;
      reflectedLocations.current.delete(reflected);
      reflectedLocations.current.add(reflected);
      if (device) url.searchParams.set("previewDevice", device);
      else url.searchParams.delete("previewDevice");
      void navigate({
        href: url.pathname + url.search + url.hash,
        replace: true,
        resetScroll: false,
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [device, navigate]);

  return (
    <div className="overflow-x-auto bg-muted/30">
      <iframe
        ref={frame}
        src={initialHref}
        onLoad={() => {
          if (frame.current?.contentDocument) applyTheme(theme, frame.current.contentDocument);
        }}
        title="Responsive component preview"
        id="factory-device-preview"
        name="factory-device-preview"
        className="mx-auto block h-[calc(100svh-var(--showroom-header-height))] bg-background"
        style={{ width: device === "phone" ? 390 : device === "tablet" ? 768 : "100%" }}
      />
    </div>
  );
}
