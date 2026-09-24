export interface AnalyticsConsent {
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentAnalyticsOptions {
  measurementId?: string;
  adsId?: string;
  adsConversionLabel?: string;
  nonce?: string;
  /** Optional host script manager. Resolve only when the script is ready; reject on failure. */
  loadScript?: (url: string) => Promise<void>;
}

export interface ConsentAnalytics {
  /** Connect to CookieBanner.onConsentChange; catch failures in the host. Calling again retries. */
  updateConsent: (consent: AnalyticsConsent) => Promise<void>;
  /** Events before consent or before a successful load are discarded, never replayed later. */
  trackEvent: (name: string, parameters?: Record<string, unknown>) => boolean;
  trackAdsConversion: (action: string) => boolean;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: object[];
    __forgeGoogleConsent?: AnalyticsConsent;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const denied: AnalyticsConsent = { analytics: false, marketing: false };
function googleConsent(consent: AnalyticsConsent) {
  return {
    ad_storage: consent.marketing ? "granted" : "denied",
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
  };
}

/** Sets Consent Mode v2 defaults and choices without loading scripts or making requests. */
export function applyGoogleConsent(consent: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  window.dataLayer ??= [];
  window.gtag ??= function () {
    // The Google tag queue uses Arguments objects, as in Google's installation snippet.
    window.dataLayer!.push(arguments);
  };
  const previous = window.__forgeGoogleConsent;
  if (!previous) window.gtag("consent", "default", googleConsent(denied));
  if (
    !previous ||
    previous.analytics !== consent.analytics ||
    previous.marketing !== consent.marketing
  ) {
    window.gtag("consent", "update", googleConsent(consent));
    window.__forgeGoogleConsent = { ...consent };
  }
}

function insertScript(url: string, nonce?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = url;
    script.dataset.forgeAnalytics = "";
    if (nonce) script.nonce = nonce;
    const timer = setTimeout(() => finish(new Error("Google tag loading timed out.")), 30_000);
    function finish(error?: Error) {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    }
    script.onload = () => finish();
    script.onerror = () => finish(new Error("Could not load the Google tag."));
    document.head.appendChild(script);
  });
}

/** Create once in a host module. Construction and calls during SSR have no browser effects. */
export function createConsentAnalytics(options: ConsentAnalyticsOptions = {}): ConsentAnalytics {
  const measurementId = options.measurementId?.trim();
  const adsId = options.adsId?.trim();
  const conversionLabel = options.adsConversionLabel?.trim().replace(/^\/+/, "");
  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId))
    throw new Error("Expected a GA4 measurement ID starting with G-.");
  if (adsId && !/^AW-\d+$/.test(adsId))
    throw new Error("Expected a Google Ads ID starting with AW-.");
  let consent = denied;
  let loading: Promise<void> | undefined;
  let ready = false;
  let initialized = false;
  const configured = new Set<string>();

  function configure() {
    for (const id of [consent.analytics && measurementId, consent.marketing && adsId]) {
      if (id && !configured.has(id)) {
        // Explicit event destinations keep analytics events out of the Ads destination.
        window.gtag?.("config", id);
        configured.add(id);
      }
    }
  }

  return {
    async updateConsent(next) {
      if (typeof window === "undefined") return;
      consent = { analytics: next.analytics === true, marketing: next.marketing === true };
      if (measurementId) window[`ga-disable-${measurementId}`] = !consent.analytics;
      applyGoogleConsent(consent);
      const id = (consent.analytics && measurementId) || (consent.marketing && adsId);
      if (!id) return;
      if (ready) {
        configure();
        return;
      }
      if (!loading) {
        if (!initialized) {
          window.gtag?.("js", new Date());
          initialized = true;
        }
        loading = Promise.resolve()
          .then(async () => {
            const currentId = (consent.analytics && measurementId) || (consent.marketing && adsId);
            if (!currentId) return;
            const url = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(currentId)}`;
            const load = options.loadScript ?? ((src: string) => insertScript(src, options.nonce));
            await load(url);
            ready = true;
          })
          .finally(() => {
            loading = undefined;
          });
      }
      await loading;
      // Consent may have changed while the script was loading.
      if (ready) configure();
    },
    trackEvent(name, parameters = {}) {
      if (
        typeof window === "undefined" ||
        !window.__forgeGoogleConsent?.analytics ||
        !consent.analytics ||
        !ready ||
        !measurementId ||
        !configured.has(measurementId)
      )
        return false;
      window.gtag?.("event", name, { ...parameters, send_to: measurementId });
      return true;
    },
    trackAdsConversion(action) {
      if (
        typeof window === "undefined" ||
        !window.__forgeGoogleConsent?.marketing ||
        !consent.marketing ||
        !ready ||
        !adsId ||
        !conversionLabel ||
        !configured.has(adsId)
      )
        return false;
      window.gtag?.("event", "conversion", {
        send_to: `${adsId}/${conversionLabel}`,
        event_category: "engagement",
        event_label: action,
      });
      return true;
    },
  };
}
