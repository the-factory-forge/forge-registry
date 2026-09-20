"use client";

import { useState } from "react";

import { CookieBanner, type ConsentState } from "@/components/cookie-banner";
import { ManageCookiesButton } from "@/components/manage-cookies-button";

export default function CookieBannerPage() {
  const [appliedConsent, setAppliedConsent] = useState<ConsentState | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showMarketing, setShowMarketing] = useState(true);

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Layout
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Cookie banner</h1>
        </div>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Preview controls</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reopen the banner to review saved preferences. This preview does not load analytics
          scripts.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
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
        </div>
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

      <CookieBanner
        consentKey="forge-cookie-banner-preview"
        text="We use cookies to improve your experience and analyze site traffic."
        acceptSelectionLabel="Custom selection"
        cancelLabel="Cancel"
        confirmLabel="Confirm selection"
        showAnalytics={showAnalytics}
        showMarketing={showMarketing}
        onConsentChange={setAppliedConsent}
        acceptAllLabel="Accept all"
        policyLabel="Privacy policy"
        privacyHref="#privacy"
      />
    </main>
  );
}
