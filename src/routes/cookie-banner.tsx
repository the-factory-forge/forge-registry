import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { CookieBanner, type ConsentState } from "@/components/cookie-banner";
import { ManageCookiesButton } from "@/components/manage-cookies-button";
import { createConsentAnalytics } from "@/components/utils/consent-analytics";
import { ShowroomPreview } from "@/showroom/showroom-preview";

function CookieBannerPage() {
  const [appliedConsent, setAppliedConsent] = useState<ConsentState | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showMarketing, setShowMarketing] = useState(true);

  const fail = useRef(false);
  const [attempts, setAttempts] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [eventResult, setEventResult] = useState("");
  // The factory stores loadScript; it reads the ref only after a consent event.
  // oxlint-disable-next-line react-hooks-js/refs, react/refs
  const [analytics] = useState(() =>
    createConsentAnalytics({
      measurementId: "G-SHOWROOM",
      adsId: "AW-123456789",
      adsConversionLabel: "showroom",
      // Exercise the real consent controller without contacting a tracking provider.
      loadScript: async () => {
        setAttempts((count) => count + 1);
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (fail.current) throw new Error("Preview load failure");
      },
    }),
  );
  function applyConsent(consent: ConsentState) {
    setAppliedConsent(consent);
    setLoadError(false);
    void analytics.updateConsent(consent).catch(() => setLoadError(true));
  }

  return (
    <ShowroomPreview
      width="narrow"
      controls={
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAnalytics}
              onChange={(event) => setShowAnalytics(event.target.checked)}
            />
            Offer analytics cookies
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMarketing}
              onChange={(event) => setShowMarketing(event.target.checked)}
            />
            Offer marketing cookies
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              onChange={(event) => {
                fail.current = event.target.checked;
              }}
            />
            Simulate analytics loading failure
          </label>
        </>
      }
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Layout
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Cookie banner</h1>
        </div>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Cookie preferences</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The shared analytics loader follows your saved choices. This preview uses a local
          simulation and sends no requests to Google.
        </p>

        <output
          aria-label="Applied cookie preferences"
          className="mt-4 block text-sm text-muted-foreground"
        >
          {appliedConsent
            ? `Analytics: ${appliedConsent.analytics ? "granted" : "denied"}; marketing: ${appliedConsent.marketing ? "granted" : "denied"}`
            : "Loading saved preferences…"}
        </output>
        <ManageCookiesButton
          label="Open cookie banner"
          className="mt-5 rounded-lg border border-border px-4 py-2 font-semibold text-foreground hover:bg-muted hover:text-foreground"
        />
      </section>
      <section className="mt-6 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Consent-driven analytics</h2>
        <output className="mt-3 block text-sm" aria-label="Script load attempts">
          Script load attempts: {attempts}
        </output>
        {loadError && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-destructive">
              The analytics script could not load.
            </p>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                if (appliedConsent) applyConsent(appliedConsent);
              }}
            >
              Retry analytics loading
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() =>
              setEventResult(
                analytics.trackEvent("preview_click")
                  ? "Analytics event accepted."
                  : "Analytics event blocked.",
              )
            }
          >
            Try analytics event
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() =>
              setEventResult(
                analytics.trackAdsConversion("phone")
                  ? "Conversion accepted."
                  : "Conversion blocked.",
              )
            }
          >
            Try conversion
          </button>
        </div>
        <output className="mt-3 block text-sm" aria-label="Tracking result">
          {eventResult}
        </output>
      </section>

      <CookieBanner
        consentKey="forge-cookie-banner-preview"
        text="We use cookies to improve your experience and analyze site traffic."
        acceptSelectionLabel="Custom selection"
        cancelLabel="Cancel"
        confirmLabel="Confirm selection"
        showAnalytics={showAnalytics}
        showMarketing={showMarketing}
        onConsentChange={applyConsent}
        acceptAllLabel="Accept all"
        policyLabel="Privacy policy"
        privacyHref="#privacy"
      />
    </ShowroomPreview>
  );
}

export const Route = createFileRoute("/cookie-banner")({ component: CookieBannerPage });
