# Cookie banner

Install `@forge/cookie-banner` and, for a footer preferences link,
`@forge/manage-cookies-button`. Both use `manage-cookies` by default; pass the
same `manageEvent` to each when customizing it.

The banner shows the necessary category and each enabled optional category
immediately, with **Accept all**, **Save selection**, and **Reject all** actions.
Necessary cookies stay enabled. `showAnalytics` defaults to `true` and
`showMarketing` defaults to `false`; unavailable categories are always denied,
including when restoring a saved choice or accepting all cookies.

Consent is stored under `consentKey` (`cookie-consent` by default). Reopening the
banner restores saved choices. Checkbox changes remain drafts until saved;
changes in another tab apply automatically. Invalid saved data starts denied.
If browser storage is blocked, choices last for the mounted page only.

## Host analytics integration

The banner retains its existing Google Consent Mode updates but does not load
tracking scripts. Supply `onConsentChange` to connect the host's analytics
loader or another consent adapter. It receives `{ necessary, analytics,
marketing }` after initial hydration, a saved choice, or a storage change in
another tab. It is also called when available categories change. It is not
called for draft checkbox edits or simply reopening preferences.

```tsx
"use client";

import { CookieBanner, type ConsentState } from "@/components/cookie-banner";
import { loadGtag } from "@/lib/analytics"; // Your website's loader and tracking IDs.

function applySiteConsent(consent: ConsentState) {
  if (consent.analytics || consent.marketing) {
    loadGtag();
  }
}

export function SiteCookieBanner() {
  return (
    <CookieBanner
      text="Choose which optional cookies this website may use."
      acceptAllLabel="Accept all"
      acceptSelectionLabel="Save selection"
      rejectLabel="Reject all"
      policyLabel="Privacy policy"
      privacyHref="/privacy"
      showAnalytics
      showMarketing={false}
      onConsentChange={applySiteConsent}
    />
  );
}
```

The host owns tracking IDs, script loading, and any provider-specific shutdown
or cleanup after consent is revoked. Keep the callback and loader idempotent:
React development effects can run more than once. Handle asynchronous loader
errors in the host. Do not load tracking scripts unconditionally elsewhere if
they must wait for consent. Google consent updates are queued before the
callback runs, so a consent-aware loader can consume the queue when it loads.

## Updating an existing installation

Replace callbacks that imported website analytics directly into the copied
banner with the `onConsentChange` prop in a host-owned wrapper. Update translated
`acceptSelectionLabel` to describe saving the selected categories, and supply a
translated `rejectLabel` (default: `Reject all`). `cancelLabel` and `confirmLabel`
remain accepted for source compatibility but are deprecated and unused by the
restored single-step interface. Explicitly enable `showMarketing` when needed.

## Preview and regression checks

`/cookie-banner` includes category availability controls and shows the last
applied consent from the callback. The preview does not load tracking scripts.

With the showroom running via `pnpm dev`, run:

```bash
pnpm exec playwright install chromium # Once per development environment.
pnpm test:browser
```

Set `TEST_BASE_URL` to test another local showroom port. The Node browser tests
cover saved choices, rejection, draft isolation, category availability,
cross-tab synchronization, invalid data, and unavailable storage.
