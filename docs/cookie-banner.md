# Cookie banner

Install `@forge/cookie-banner` and, for a footer preferences link,
`@forge/manage-cookies-button`. Both use `manage-cookies` by default; pass the
same `manageEvent` to each when customizing it.

The banner starts compact with **Custom selection** and **Accept all** actions.
Custom selection reveals the necessary category and each enabled optional
category, while the actions become **Cancel** and **Confirm selection**.
Necessary cookies stay enabled. `showAnalytics` defaults to `true` and
`showMarketing` defaults to `false`; unavailable categories are always denied,
including when restoring a saved choice or accepting all cookies.

Consent is stored under `consentKey` (`cookie-consent` by default). Reopening the
banner stays compact; opening custom selection restores saved choices. Checkbox
changes remain drafts until confirmed, and Cancel discards them. Changes in
another tab apply automatically. Invalid saved data starts denied.
If browser storage is blocked, choices last for the mounted page only.

## Consent-driven analytics

`@forge/cookie-banner` installs `@forge/consent-analytics` automatically. You can
also install the utility alone. It has no framework or analytics package
dependencies and does not import environment variables.

Create one controller per document in a host-owned module. Pass your public
tracking IDs and connect every consent change, including denial, to it.
Construction and calls during server rendering have no browser effects.

```tsx
import { CookieBanner } from "@/components/cookie-banner";
import {
  createConsentAnalytics,
  type AnalyticsConsent,
} from "@/components/utils/consent-analytics";

// Keep this controller outside the component and registry-managed directories.
const analytics = createConsentAnalytics({
  measurementId: "G-YOURID",
  adsId: "AW-123456789",
  adsConversionLabel: "your-conversion-label",
});

function applySiteConsent(consent: AnalyticsConsent) {
  void analytics.updateConsent(consent).catch((error: unknown) => {
    console.error("Analytics could not load", error);
  });
}

export function SiteCookieBanner() {
  return (
    <CookieBanner
      text="Choose which optional cookies this website may use."
      acceptAllLabel="Accept all"
      acceptSelectionLabel="Custom selection"
      cancelLabel="Cancel"
      confirmLabel="Confirm selection"
      policyLabel="Privacy policy"
      privacyHref="/privacy"
      showAnalytics
      showMarketing
      onConsentChange={applySiteConsent}
    />
  );
}

export const trackEvent = analytics.trackEvent;
export const trackAdsConversion = analytics.trackAdsConversion;
```

Omit IDs for services the website does not use. Invalid IDs throw during
construction. `measurementId` accepts GA4 IDs beginning with `G-`; `adsId` accepts
`AW-` followed by digits. Conversion labels may have a leading slash.

The banner queues denied Consent Mode v2 defaults before any updates. Its
callback receives `{ necessary, analytics, marketing }` after hydration,
saved choices, cross-tab storage changes, and changes to available categories.
Draft checkbox edits and reopening preferences do not call it.

The controller loads one Google tag script only when consent permits a configured
destination. Analytics consent configures GA4; marketing consent configures Ads.
Repeated callbacks share the in-flight load and do not repeat destination setup.
A load error or 30-second timeout rejects `updateConsent`; calling it again with
the current consent retries. Failed script elements are removed. Consent changes
during loading are checked again before configuring destinations.

`trackEvent(name, parameters)` targets GA4 explicitly. `trackAdsConversion(action)`
uses the Ads destination and configured conversion label. Both return `false`
unless their category is allowed and the script has loaded. Blocked events are
discarded, not replayed after a later acceptance. Events return `true` when queued;
this does not confirm receipt by Google. The host owns page-view strategy and
which user interactions produce events.

On withdrawal the controller updates Consent Mode, disables GA4 collection with
Google's `ga-disable` flag, and stops its own event helpers. An already loaded
Google script remains in memory; Google can send consent or cookieless pings,
particularly for an initialized Ads destination. This utility does not remove
existing provider cookies or promise to unload Google. See Google's
[Consent Mode behavior](https://developers.google.com/tag-platform/security/concepts/consent-mode)
and [GA collection controls](https://developers.google.com/tag-platform/security/guides/privacy).
Keep the website's consent policy and any additional provider cleanup in its host adapter.

`nonce` supports a host's CSP nonce. `loadScript(url)` optionally delegates to a
host script manager and must resolve only when ready or reject on failure. The
showroom uses it to simulate loading without contacting Google. The default
loader uses `https://www.googletagmanager.com/gtag/js`; hosts own CSP allowances.

## Updating an existing installation

Refresh `@forge/cookie-banner` and its linked `@forge/consent-analytics` dependency
through shadcn, review the source diff, and keep IDs and site callbacks outside
registry-managed directories. Existing `onConsentChange` callers remain supported.

Replace conditional `if (analytics || marketing) loadGtag()` adapters with the
unconditional `updateConsent(consent)` call above so withdrawal reaches the loader.
Remove duplicate inline defaults and unconditional Google script/config tags.
Only this controller should initialize the website's Google destinations.

For older banner installations, remove `rejectLabel`, use `acceptSelectionLabel`
for the custom-selection action, and translate `cancelLabel` and `confirmLabel`.
Explicitly enable `showMarketing` when needed.

## Preview and regression checks

`/cookie-banner` demonstrates category choices, event gating, script failure, and
retry in the shared preview controls. Its tracking script is simulated locally.
The showroom homepage links this example under Cookie banner.

With the showroom running via `pnpm dev`, run:

```bash
pnpm test
pnpm exec playwright install chromium # Once per development environment.
pnpm test:browser
```

Set `TEST_BASE_URL` for another local showroom port. Tests cover saved and draft
choices, storage failures, cross-tab updates, category isolation, SSR, concurrent
loads, retries, and withdrawal during loading.
