import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

import {
  applyGoogleConsent,
  createConsentAnalytics,
} from "../registry/components/utils/consent-analytics.ts";
const denied = { analytics: false, marketing: false };
const all = { analytics: true, marketing: true };
const commands = () => (window.dataLayer ?? []).map((entry) => Array.from(entry));
afterEach(() => {
  delete globalThis.window;
});
function setup(loadScript = async () => {}) {
  globalThis.window = {};
  return createConsentAnalytics({
    measurementId: "G-TEST",
    adsId: "AW-123456",
    adsConversionLabel: "/example",
    loadScript,
  });
}

test("SSR and missing IDs do not load scripts; defaults precede updates", async () => {
  let loads = 0;
  const analytics = createConsentAnalytics({
    loadScript: async () => {
      loads++;
    },
  });
  await analytics.updateConsent(all);
  assert.equal(analytics.trackEvent("example"), false);
  assert.equal(typeof window, "undefined");
  globalThis.window = {};
  await analytics.updateConsent(all);
  assert.equal(loads, 0);
  assert.deepEqual(
    commands().map((entry) => entry.slice(0, 2)),
    [
      ["consent", "default"],
      ["consent", "update"],
    ],
  );
  assert.equal(commands()[0][2].analytics_storage, "denied");
  assert.equal(commands()[0][2].ad_user_data, "denied");
  assert.throws(() => createConsentAnalytics({ measurementId: "AW-123" }), /measurement ID/);
});

test("each category configures only its destination; events are gated and routed explicitly", async () => {
  const urls = [];
  const analytics = setup(async (url) => {
    urls.push(url);
  });
  await analytics.updateConsent(denied);
  assert.equal(analytics.trackEvent("before"), false);
  assert.equal(analytics.trackAdsConversion("phone"), false);
  assert.deepEqual(urls, []);
  await analytics.updateConsent({ ...denied, analytics: true });
  await analytics.updateConsent({ ...denied, analytics: true });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /id=G-TEST$/);
  assert.deepEqual(
    commands().filter(([name]) => name === "config"),
    [["config", "G-TEST"]],
  );
  assert.equal(analytics.trackAdsConversion("phone"), false);
  assert.equal(analytics.trackEvent("select_content", { send_to: "AW-123456" }), true);
  assert.equal(commands().at(-1)[2].send_to, "G-TEST");
  await analytics.updateConsent({ ...denied, marketing: true });
  assert.equal(window["ga-disable-G-TEST"], true);
  assert.equal(analytics.trackEvent("after"), false);
  assert.equal(analytics.trackAdsConversion("phone"), true);
  assert.deepEqual(commands().at(-1), [
    "event",
    "conversion",
    { send_to: "AW-123456/example", event_category: "engagement", event_label: "phone" },
  ]);
  await analytics.updateConsent(denied);
  assert.equal(analytics.trackAdsConversion("phone"), false);
  await analytics.updateConsent(all);
  assert.equal(window["ga-disable-G-TEST"], false);
  assert.equal(urls.length, 1);
  assert.equal(commands().filter(([name]) => name === "config").length, 2);
  assert.equal(commands().filter(([name]) => name === "js").length, 1);
});

test("marketing-only acceptance does not configure analytics", async () => {
  const urls = [];
  const analytics = setup(async (url) => {
    urls.push(url);
  });
  await analytics.updateConsent({ ...denied, marketing: true });
  assert.match(urls[0], /id=AW-123456$/);
  assert.deepEqual(
    commands().filter(([name]) => name === "config"),
    [["config", "AW-123456"]],
  );
  assert.equal(analytics.trackEvent("example"), false);
  // Banner updates alone must also immediately stop our event helpers.
  applyGoogleConsent(denied);
  assert.equal(analytics.trackAdsConversion("phone"), false);
});

test("simultaneous callbacks share a load and withdrawal prevents late configuration", async () => {
  let complete;
  let loads = 0;
  const analytics = setup(() => {
    loads++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const first = analytics.updateConsent(all);
  const second = analytics.updateConsent(all);
  await Promise.resolve();
  assert.equal(loads, 1);
  assert.equal(analytics.trackEvent("during"), false);
  await analytics.updateConsent(denied);
  complete();
  await Promise.all([first, second]);
  assert.equal(commands().filter(([name]) => name === "config").length, 0);
  assert.equal(analytics.trackAdsConversion("after"), false);
  await analytics.updateConsent(all);
  assert.equal(loads, 1);
  assert.equal(commands().filter(([name]) => name === "config").length, 2);
});

test("load failures propagate and retry without publishing events or duplicate initialization", async () => {
  let loads = 0;
  const analytics = setup(async () => {
    if (++loads === 1) throw new Error("Blocked");
  });
  await assert.rejects(analytics.updateConsent(all), /Blocked/);
  assert.equal(analytics.trackEvent("failed"), false);
  assert.equal(commands().filter(([name]) => name === "config").length, 0);
  await analytics.updateConsent(all);
  assert.equal(loads, 2);
  assert.equal(analytics.trackEvent("ready"), true);
  assert.equal(commands().filter(([name]) => name === "js").length, 1);
});

test("the banner installs the standalone loader without auth, framework, or analytics packages", async () => {
  const manifest = JSON.parse(await readFile("registry/registry.json", "utf8"));
  const item = manifest.items.find(({ name }) => name === "consent-analytics");
  assert.deepEqual(item.dependencies ?? [], []);
  assert.deepEqual(item.registryDependencies ?? [], []);
  assert.ok(
    manifest.items
      .find(({ name }) => name === "cookie-banner")
      .registryDependencies.includes("@forge/consent-analytics"),
  );
  const published = JSON.parse(await readFile("public/r/consent-analytics.json", "utf8"));
  assert.equal(published.files[0].content, await readFile(item.files[0].path, "utf8"));
});
