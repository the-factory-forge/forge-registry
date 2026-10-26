"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { applyGoogleConsent } from "@/components/utils/consent-analytics";

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

export interface CookieBannerProps {
  consentKey?: string;
  manageEvent?: string;
  text: string;
  acceptAllLabel: string;
  acceptSelectionLabel: string;
  cancelLabel?: string;
  closeLabel?: string;
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
  cancelLabel = "Cancel",
  closeLabel = "Close",
  confirmLabel = "Confirm selection",
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
  const [customizing, setCustomizing] = useState(false);
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
    applyGoogleConsent(state);
    consentCallback.current?.({ ...state });
  }, []);

  const evaluate = useCallback(() => {
    const stored = readConsent(consentKey);
    const state = normalizeConsent(stored ?? DEFAULT_CONSENT);
    setDraft(state);
    setCustomizing(false);
    setVisible(stored === null);
    notifyConsent(state);
  }, [consentKey, normalizeConsent, notifyConsent]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- hydrate saved consent and listen for external changes
    evaluate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === consentKey || event.key === null) evaluate();
    };
    const onManage = () => {
      setDraft(normalizeConsent(readConsent(consentKey) ?? savedConsent.current));
      setCustomizing(false);
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
    setCustomizing(false);
    setVisible(false);
    notifyConsent(state);
  };

  const cancelSelection = () => {
    setDraft(savedConsent.current);
    setCustomizing(false);
  };

  if (hidden || !visible) return null;

  return (
    <dialog
      id="factory-cookie-banner"
      open
      aria-label={dialogLabel}
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 z-[60] m-0 w-full max-w-none border-0 bg-transparent p-4 sm:p-6",
        "animate-in duration-300 fade-in slide-in-from-bottom-4",
      )}
    >
      <div className="container-premium">
        <div
          className={cn(
            "relative flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3 pr-16 shadow-lg",
            !customizing && "sm:flex-row sm:items-center",
          )}
        >
          <IconTooltip label={closeLabel}>
            <button
              type="button"
              aria-label={closeLabel}
              className="absolute top-3 right-3 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:size-8"
              onClick={() => {
                cancelSelection();
                setVisible(false);
              }}
            >
              <XIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </IconTooltip>
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
              onClick={customizing ? cancelSelection : () => setCustomizing(true)}
              aria-expanded={customizing}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed"
            >
              {customizing ? cancelLabel : acceptSelectionLabel}
            </button>
            <button
              type="button"
              onClick={() =>
                saveConsent(
                  customizing ? draft : { necessary: true, analytics: true, marketing: true },
                )
              }
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/40 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed"
            >
              {customizing ? confirmLabel : acceptAllLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
