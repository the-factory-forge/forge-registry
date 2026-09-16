import Link from "next/link";

import { CookieBanner } from "@/components/forge/layouts/cookie-banner";
import { ManageCookiesButton } from "@/components/forge/navigation/manage-cookies-button";

export default function CookieBannerPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-6 sm:p-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Layout
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Cookie banner
          </h1>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          Back to components
        </Link>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Preview controls</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reopen the banner after accepting either consent option.
        </p>
        <ManageCookiesButton
          label="Open cookie banner"
          className="mt-5 rounded-lg border border-border px-4 py-2 font-semibold text-foreground hover:bg-muted hover:text-foreground"
        />
      </section>

      <CookieBanner
        consentKey="forge-cookie-banner-preview"
        text="We use cookies to improve your experience and analyze site traffic."
        acceptSelectionLabel="Accept necessary"
        acceptAllLabel="Accept all"
        policyLabel="Privacy policy"
        privacyHref="#privacy"
      />
    </main>
  );
}
