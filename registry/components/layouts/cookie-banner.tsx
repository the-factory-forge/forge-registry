"use client";

import { useEffect, useState, useCallback } from "react";

import { cn } from "@/lib/forge/utils";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: object[];
  }
}

export interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
};

function ensureGtag() {
  if (typeof window === "undefined") return;
  window.gtag =
    window.gtag ||
    ((...args: unknown[]) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(args);
    });
}

function serialize(state: ConsentState): string {
  return JSON.stringify(state);
}

function deserialize(raw: string): ConsentState | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.necessary === "boolean" &&
      typeof parsed.analytics === "boolean" &&
      typeof parsed.marketing === "boolean"
    ) {
      return parsed as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

function applyConsent(state: ConsentState) {
  ensureGtag();
  window.gtag?.("consent", "update", {
    ad_storage: state.marketing ? "granted" : "denied",
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
  });
}

export interface CookieBannerProps {
  consentKey?: string;
  manageEvent?: string;
  text: string;
  acceptAllLabel: string;
  acceptSelectionLabel: string;
  policyLabel: string;
  privacyHref: string;
  dialogLabel?: string;
  hidden?: boolean;
}

export function CookieBanner({
  consentKey = "cookie-consent",
  manageEvent = "manage-cookies",
  text,
  acceptAllLabel,
  acceptSelectionLabel,
  policyLabel,
  privacyHref,
  dialogLabel = "Cookies",
  hidden = false,
}: CookieBannerProps) {
  const [visible, setVisible] = useState(false);

  const evaluate = useCallback(() => {
    const stored = localStorage.getItem(consentKey);
    if (stored) {
      const parsed = deserialize(stored);
      if (parsed) {
        applyConsent(parsed);
        setVisible(false);
        return;
      }
    }
    applyConsent(DEFAULT_CONSENT);
    setVisible(true);
  }, [consentKey]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- lit le consent stocké (setState d'hydratation)
    evaluate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === consentKey) evaluate();
    };
    const onManage = () => {
      setVisible(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(manageEvent, onManage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(manageEvent, onManage);
    };
  }, [evaluate, consentKey, manageEvent]);

  const acceptAll = () => {
    const state: ConsentState = { necessary: true, analytics: true, marketing: true };
    localStorage.setItem(consentKey, serialize(state));
    applyConsent(state);
    setVisible(false);
  };

  const acceptSelection = () => {
    localStorage.setItem(consentKey, serialize(DEFAULT_CONSENT));
    applyConsent(DEFAULT_CONSENT);
    setVisible(false);
  };

  if (hidden || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label={dialogLabel}
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6",
        "animate-in duration-300 fade-in slide-in-from-bottom-4",
      )}
    >
      <div className="container-premium">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-lg sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {text}{" "}
            <a
              href={privacyHref}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {policyLabel}
            </a>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={acceptSelection}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {acceptSelectionLabel}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40"
            >
              {acceptAllLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
