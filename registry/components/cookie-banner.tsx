"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "@/components/utils/cn";

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
      typeof parsed.analytics === "boolean" &&
      typeof parsed.marketing === "boolean"
    ) {
      return {
        necessary: true,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
      };
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
  cancelLabel?: string;
  confirmLabel?: string;
  policyLabel: string;
  privacyHref: string;
  necessaryTitle?: string;
  necessaryDescription?: string;
  analyticsTitle?: string;
  analyticsDescription?: string;
  marketingTitle?: string;
  marketingDescription?: string;
  showAnalytics?: boolean;
  showMarketing?: boolean;
  dialogLabel?: string;
  hidden?: boolean;
}

export function CookieBanner({
  consentKey = "cookie-consent",
  manageEvent = "manage-cookies",
  text,
  acceptAllLabel,
  acceptSelectionLabel,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm Selection",
  policyLabel,
  privacyHref,
  necessaryTitle = "Necessary",
  necessaryDescription = "Required for the website to function properly.",
  analyticsTitle = "Statistics",
  analyticsDescription = "Helps us understand how visitors interact with the site.",
  marketingTitle = "Marketing",
  marketingDescription = "Measures conversions and personalizes advertising.",
  showAnalytics = true,
  showMarketing = true,
  dialogLabel = "Cookies",
  hidden = false,
}: CookieBannerProps) {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_CONSENT);

  const evaluate = useCallback(() => {
    const stored = localStorage.getItem(consentKey);
    if (stored) {
      const parsed = deserialize(stored);
      if (parsed) {
        applyConsent(parsed);
        setDraft(parsed);
        setCustomizing(false);
        setVisible(false);
        return;
      }
    }
    applyConsent(DEFAULT_CONSENT);
    setDraft(DEFAULT_CONSENT);
    setCustomizing(false);
    setVisible(true);
  }, [consentKey]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- reads stored consent during hydration
    evaluate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === consentKey) evaluate();
    };
    const onManage = () => {
      setCustomizing(false);
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
    const state: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    localStorage.setItem(consentKey, serialize(state));
    applyConsent(state);
    setCustomizing(false);
    setVisible(false);
  };

  const openSelection = () => {
    setDraft(DEFAULT_CONSENT);
    setCustomizing(true);
  };

  const cancelSelection = () => {
    setDraft(DEFAULT_CONSENT);
    setCustomizing(false);
  };

  const confirmSelection = () => {
    const state = { ...draft, necessary: true };
    localStorage.setItem(consentKey, serialize(state));
    applyConsent(state);
    setCustomizing(false);
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
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-lg",
            !customizing && "sm:flex-row sm:items-center",
          )}
        >
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {text}{" "}
            <a
              href={privacyHref}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {policyLabel}
            </a>
          </p>

          {customizing && (
            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <label
                aria-label={necessaryTitle}
                className="flex cursor-not-allowed items-start gap-3 opacity-70"
              >
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="mt-0.5 size-4 shrink-0 rounded accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {necessaryTitle}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {necessaryDescription}
                  </span>
                </span>
              </label>

              {showAnalytics && (
                <label
                  aria-label={analyticsTitle}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    type="checkbox"
                    checked={draft.analytics}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        analytics: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 shrink-0 rounded accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {analyticsTitle}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {analyticsDescription}
                    </span>
                  </span>
                </label>
              )}

              {showMarketing && (
                <label
                  aria-label={marketingTitle}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    type="checkbox"
                    checked={draft.marketing}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        marketing: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 shrink-0 rounded accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {marketingTitle}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {marketingDescription}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={customizing ? cancelSelection : openSelection}
              aria-expanded={customizing}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {customizing ? cancelLabel : acceptSelectionLabel}
            </button>
            <button
              type="button"
              onClick={customizing ? confirmSelection : acceptAll}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40"
            >
              {customizing ? confirmLabel : acceptAllLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
