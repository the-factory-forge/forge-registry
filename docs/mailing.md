# Mailing

`@forge/mailing` is a service plugin shared by features that send transactional
email. It uses React Email components to render branded HTML and matching plain text. It has no administration
screen, database, subscription list or runtime plugin loader.

[Preview account and reservation emails](/mailing).

Each sample has a direct showroom link:

| Account messages                               | Reservation messages                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| [Verify your email](/mailing/verify-email)     | [Request received](/mailing/reservation-booked)        |
| [Reset your password](/mailing/reset-password) | [Stay confirmed](/mailing/reservation-confirmation)    |
| [Accept an invitation](/mailing/invitation)    | [Stay rescheduled](/mailing/reservation-rescheduled)   |
| [Confirm a new address](/mailing/email-change) | [Request rejected](/mailing/reservation-rejected)      |
|                                                | [Stay cancelled](/mailing/reservation-cancelled)       |
|                                                | [Recover a management link](/mailing/reservation-link) |

`/mailing` opens verification. The original verification, reset and confirmation
URLs still work. Account and Reservations are independently collapsible groups.
Opening another sample also opens its group, including through Back/Forward.
The format control exposes the matching plain text.

The Brand control compares The Corner, Northstar Studio and Pinewood Lodge using
the same message and layout. The Corner uses the existing `/icon.png`, deep teal
`#13343a` and Work Sans with local fallbacks. Northstar and Pinewood are fictional
identities with their own PNG logos, semantic colors and font stacks. These presets live in
[`src/showroom/mailing-examples.ts`](../src/showroom/mailing-examples.ts); they are
not installed with `@forge/mailing` or used by customer sites.

Brand and format are URL state. For example,
[/mailing/invitation?brand=lodge&format=text](/mailing/invitation?brand=lodge&format=text)
opens Pinewood Lodge's invitation as text. Missing or invalid values select
Northstar Studio and HTML; returning to those defaults removes their parameters.
Switching messages, reloading and Back/Forward retain the selected view.

Names, dates, destinations, tokens and expiry times are sample data. These previews
render only; they do not issue account tokens, create reservations or send mail.
The HTML stays in a sandboxed iframe and can be inspected with images blocked.
A browser preview does not establish compatibility with every inbox client.

```sh
vpr ui add @forge/mailing
```

## Rendering

```ts
import { renderEmail } from "@/components/plugins/mailing/index";

const content = await renderEmail({
  brand: { name: "Your website", logoUrl: "https://example.com/icon.png" },
  locale: "en",
  preview: "Your reservation is confirmed.",
  heading: "See you soon",
  greeting: "Hello Alex,",
  paragraphs: ["Your reservation is confirmed. Keep these details for your visit."],
  details: [{ label: "Arrival", value: "16 October 2026" }],
  action: { label: "View reservation", url: "https://example.com/reservations" },
  footer: "Sign in to view your reservation.",
});
// content.html and content.text describe the same message and action.
```

The renderer exports the `TransactionalEmail` JSX template, `MailingBrand`,
`MailingTheme`, `EmailContent` and `RenderedEmail`. `renderEmail` is asynchronous
and returns `Promise<RenderedEmail>`. React Email renders the HTML; the plain-text
alternative keeps the same copy and labeled details. React escapes text content. Actions and
logos require absolute HTTP(S) URLs without credentials. The host supplies trusted
destinations, translations, preview text and optional logo, details and footer.
There is no raw-HTML slot or tracking pixel. Brand theme values are trusted
application configuration, never submitted user CSS.

The centered card, logo, heading, action and quiet footer follow the Up4it account
emails. Up4it code and assets are reference material only; no runtime imports or
Up4it branding ship. L'Aspic supplies its own logo, French copy and palette.

Emails use table layout and inline styles because they cannot inherit a website's
Tailwind stylesheet or CSS variables. `brand.theme` uses the existing semantic
roles with concrete values, including matching card and primary foregrounds.
Keep these values aligned with the host theme. Font stacks have local serif and
sans-serif fallbacks; remote fonts are not required. The default email is light
and remains self-contained. Inbox clients may apply their own dark-mode colors.
Browser previews do not certify every Outlook, Gmail or Apple Mail version.

## One brand adapter per host

Keep company identity in one host-owned adapter outside installed Registry paths.
Existing examples are Sinigest's
[`src/intranet/auth/email-template.ts`](https://github.com/the-factory-forge/sinigest/blob/main/src/intranet/auth/email-template.ts)
and L'Aspic's
[`src/intranet/mailing/template.ts`](https://github.com/the-factory-forge/l-aspic/blob/main/src/intranet/mailing/template.ts).
Both wrap `renderEmail`; L'Aspic shares its wrapper between auth and reservations.
Updating `src/intranet/components/forge/plugins/mailing` must preserve these adapters.

The host supplies its name, absolute logo URL and complete light email palette:
`background`/`foreground`, `card`/`cardForeground`, `primary`/`primaryForeground`,
`muted`/`mutedForeground` and `border`. Keep those values aligned with the website's
semantic tokens. Supply `fontSans` and `fontSerif` with local fallbacks. Sinigest
uses a PNG alternative to its WebP site logo; L'Aspic uses `SITE_LOGO`. Keep the
company name visible as text when images fail. Do not copy a showroom preset into
a customer site or edit installed renderer files for branding.

## Local previews and captured delivery

Construct each message in a pure host builder shared by delivery and previews.
Pass its locale, translated copy, trusted base URL, action URL and message data as
arguments. Return its subject plus rendered HTML/text. Keep environment access,
database reads, token issuance and provider calls in the existing server adapter.
Existing brand adapters import site constants that read `varlock/env`; separate
that dependency when extracting builders, or mock only the base URL in tests.

Use the host's existing Vite+ test runner to export synthetic fixtures. For
example, add `src/intranet/auth/mailing-preview.test.ts` in a Sinigest checkout
that contains the adapter linked above:

```ts
import { mkdir, writeFile } from "node:fs/promises";

import { afterEach, test, vi } from "vite-plus/test";

vi.mock("varlock/env", () => ({ ENV: { VITE_BASE_URL: "https://example.test" } }));
afterEach(() => vi.restoreAllMocks());

test("export a synthetic account message without delivery", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("Preview must not fetch or send mail");
  });
  const { renderAuthEmail } = await import("./email-template");
  const email = await renderAuthEmail({
    subject: "Verify your email",
    body: "Confirm your address. This sample link expires in 24 hours.",
    url: "https://example.test/en/verify?token=synthetic",
    locale: "en",
    baseUrl: "https://example.test",
  });
  await mkdir(".cache/mailing", { recursive: true });
  await Promise.all([
    writeFile(".cache/mailing/verify-en.html", email.html),
    writeFile(".cache/mailing/verify-en.txt", email.text),
  ]);
});
```

Run it through the existing script, `pnpm test --run src/intranet/auth/mailing-preview.test.ts`.
Sinigest and L'Aspic already ignore `.cache` and disable application plugins in
Vite's test mode. This recipe needs no database, production credentials, new
dependency or public route. Open the HTML locally in a browser or editor preview
and inspect the text file. For logo checks, supply the host's public asset origin
as `baseUrl`; keep action destinations and tokens synthetic. Do not commit or
publish generated files.

The example exercises the existing brand adapter. During adoption, feed fixtures
through the same message builders as delivery and cover every existing type and
locale. Inspect narrow and desktop widths, long content and blocked images.
Capture actual application delivery with the host's fake provider and compare
HTML/text, subject, recipients and action destinations with those previews.
Normalize per-run tokens or IDs only after checking the trusted origin, localized
path and required parameters. Preserve existing attachments, reply-to settings,
idempotency and retry behavior. Recovery failures must retain neutral public
responses; invitation failures must keep their existing handling. Never use real
recipients or activate production action links as a test.

## Sending from a server

```ts
import { sendResendEmail } from "@/components/plugins/mailing/resend.server";

await sendResendEmail(
  { apiKey: validatedEmailApiKey, from: validatedEmailFrom },
  { to: recipient, subject: "Your reservation", ...content, id: notificationId },
);
```

`OutgoingEmail` includes `to`, `subject`, `text`, optional `html` and optional `id`.
The separate server entrypoint is not exported by the browser-safe renderer.
The host keeps credentials behind its framework's server boundary and supplies
validated recipients. Installation does not configure a provider or send email.
The registry item installs `react-email`, the same package used by Up4it. The
fetch-based Resend transport needs no additional package.

The transport has a ten-second timeout, sends both versions and throws on missing
configuration, network errors or unsuccessful provider responses. It forwards
`id` as the provider's idempotency key. Hosts retain queue ownership, retries and
safe public error handling. In particular, password recovery must retain its
neutral public response even when delivery fails. Another provider can consume
the rendered content without this Resend helper.

## Plugin integration and adoption

`@forge/reservations-storage` declares `@forge/mailing` and renders its default
notifications with it. `ReservationEmail.html` is optional. `formatEmail` may return its result synchronously or as a promise, with HTML alongside the required subject/text; existing text-only overrides
stay text-only, so recipients never receive unrelated default HTML. Delivery IDs,
leases and retry ordering remain unchanged. Hosts must forward `html` in their
transport to enable the layout.

Auth and employee verification use the host authentication provider's callbacks.
Install Mailing in that host and call the renderer/transport there; browser auth
UI and employee server operations do not need mail credentials or provider imports.
Other plugins can use the same contract when they acquire an email workflow.
There is no schema migration, scheduler or automatic installation into existing
customer sites. Preserve their routes, auth policies and localized messages.

L'Aspic's installed source lives under `src/intranet/components/forge/plugins/mailing`.
Its adapters keep French wording, the chalet palette, `SITE_LOGO`, the existing
email environment variables and `/fr/reservations` as the signed-in destination.
