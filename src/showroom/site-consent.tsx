import { useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { CookieBanner, type ConsentState } from "@/components/cookie-banner";
import { ManageCookiesButton } from "@/components/manage-cookies-button";
import { createConsentAnalytics } from "@/components/utils/consent-analytics";

// Public measurement ID of the Registry Website stream, owned by GA4 property 565838655.
const analytics = createConsentAnalytics({ measurementId: "G-BW401E4QH9" });
let lastPage: string | undefined;

function trackPage() {
  if (window.location.pathname.replace(/\/$/, "") === "/cookie-banner") return;
  const page = window.location.origin + window.location.pathname;
  if (
    page !== lastPage &&
    analytics.trackEvent("page_view", {
      page_location: page,
      page_title: document.title,
      page_referrer: lastPage ?? (document.referrer ? new URL(document.referrer).origin : ""),
    })
  )
    lastPage = page;
}

export function SiteConsent() {
  const router = useRouter();
  // Pending navigation must not mount the real tag inside the demo document.
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  });
  const isDemo = pathname.replace(/\/$/, "") === "/cookie-banner";
  const applyConsent = useCallback(
    (consent: Pick<ConsentState, "analytics" | "marketing">) => {
      if (!consent.analytics) lastPage = undefined;
      window.gtag?.("set", "send_page_view", false);
      void analytics
        .updateConsent(consent)
        .then(() => {
          if (router.state.status === "idle") trackPage();
        })
        .catch(() => {
          // A blocked tag must not interrupt the showroom; saving preferences again retries it.
        });
    },
    [router],
  );
  // Record the new page only after its content and document title have rendered.
  useEffect(() => router.subscribe("onRendered", trackPage), [router]);
  useEffect(() => {
    // The component demo changes Google consent independently of the visitor's site choice.
    if (isDemo) applyConsent({ analytics: false, marketing: false });
  }, [isDemo, applyConsent]);
  if (isDemo) return null;

  return (
    <div className="print:hidden">
      <footer className="px-4 py-3 text-center sm:px-6">
        <ManageCookiesButton
          label="Cookie settings"
          manageEvent="forge-registry-manage-cookies"
          className="min-h-10 rounded-sm px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </footer>
      <CookieBanner
        consentKey="forge-registry-cookie-consent"
        manageEvent="forge-registry-manage-cookies"
        dialogLabel="Registry cookies"
        text="Choose whether to allow statistics cookies. You can change your preferences at any time."
        acceptAllLabel="Accept all"
        acceptSelectionLabel="Custom selection"
        policyLabel="Google privacy policy"
        privacyHref="https://policies.google.com/privacy"
        onConsentChange={applyConsent}
      />
    </div>
  );
}
