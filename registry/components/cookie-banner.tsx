"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  rejectLabel?: string;
  /** @deprecated Categories are always visible; there is no cancel step. */
  cancelLabel?: string;
  /** @deprecated Use acceptSelectionLabel for the save-selection action. */
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
  /** Called after consent updates on hydration, save, and cross-tab changes, never for draft edits.
   * Keep this callback idempotent; load tracking scripts only for granted categories.
   */
  onConsentChange?: (consent: ConsentState) => void;
}

function readConsent(key: string): ConsentState | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? deserialize(stored) : null;
  } catch {
    // Storage can be unavailable; consent still works for this mounted page.
    return null;
  }
}

export function CookieBanner({
  consentKey = "cookie-consent",
  manageEvent = "manage-cookies",
  text,
  acceptAllLabel,
  acceptSelectionLabel,
  rejectLabel = "Reject all",
  policyLabel,
  privacyHref,
  necessaryTitle = "Necessary",
  necessaryDescription = "Required for the website to function properly.",
  analyticsTitle = "Statistics",
  analyticsDescription = "Helps us understand how visitors interact with the site.",
  marketingTitle = "Marketing",
  marketingDescription = "Measures conversions and personalizes advertising.",
  showAnalytics = true,
  showMarketing = false,
  dialogLabel = "Cookies",
  hidden = false,
  onConsentChange,
}: CookieBannerProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_CONSENT);
  const savedConsent = useRef(DEFAULT_CONSENT);
  const consentCallback = useRef(onConsentChange);

  useEffect(() => {
    consentCallback.current = onConsentChange;
  }, [onConsentChange]);

  const normalizeConsent = useCallback(
    (state: ConsentState): ConsentState => ({
      necessary: true,
      analytics: showAnalytics && state.analytics,
      marketing: showMarketing && state.marketing,
    }),
    [showAnalytics, showMarketing],
  );

  const notifyConsent = useCallback((state: ConsentState) => {
    savedConsent.current = state;
    applyConsent(state);
    consentCallback.current?.({ ...state });
  }, []);

  const evaluate = useCallback(() => {
    const stored = readConsent(consentKey);
    const state = normalizeConsent(stored ?? DEFAULT_CONSENT);
    setDraft(state);
    setVisible(stored === null);
    notifyConsent(state);
  }, [consentKey, normalizeConsent, notifyConsent]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- hydrate saved consent and listen for external changes
    evaluate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === consentKey || event.key === null) evaluate();
    };
    const onManage = () => {
      setDraft(normalizeConsent(readConsent(consentKey) ?? savedConsent.current));
      setVisible(true);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(manageEvent, onManage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(manageEvent, onManage);
    };
  }, [evaluate, consentKey, manageEvent, normalizeConsent]);

  const saveConsent = (selection: ConsentState) => {
    const state = normalizeConsent(selection);
    try {
      localStorage.setItem(consentKey, JSON.stringify(state));
    } catch {
      // Retain the choice in memory when persistence is blocked.
    }
    setDraft(state);
    setVisible(false);
    notifyConsent(state);
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
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-lg">
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
            {text}{" "}
            <a
              href={privacyHref}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {policyLabel}
            </a>
          </p>

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
                <span className="block text-xs text-muted-foreground">{necessaryDescription}</span>
              </span>
            </label>

            {showAnalytics && (
              <label aria-label={analyticsTitle} className="flex cursor-pointer items-start gap-3">
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
              <label aria-label={marketingTitle} className="flex cursor-pointer items-start gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => saveConsent({ necessary: true, analytics: true, marketing: true })}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40"
            >
              {acceptAllLabel}
            </button>
            <button
              type="button"
              onClick={() => saveConsent(draft)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {acceptSelectionLabel}
            </button>
            <button
              type="button"
              onClick={() => saveConsent(DEFAULT_CONSENT)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {rejectLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
