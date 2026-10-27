# Mailing

`@forge/mailing` renders transactional HTML and matching plain text. See
[ADR-0012](../concepts/adr/0012-mailing-rendering-and-transport.md) for the architecture.

[Preview account and reservation emails](/mailing).

| Section      | Examples                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account      | [Verification](/mailing/verify-email), [password reset](/mailing/reset-password), [invitation](/mailing/invitation), [email change](/mailing/email-change)                                                                                                                            |
| Reservations | [Request](/mailing/reservation-booked), [confirmation](/mailing/reservation-confirmation), [rescheduling](/mailing/reservation-rescheduled), [rejection](/mailing/reservation-rejected), [cancellation](/mailing/reservation-cancelled), [management link](/mailing/reservation-link) |

`/mailing` opens verification. Expand either section to browse its samples and
select Plain-text version to inspect `format=text`. The
[showroom contract](../openspec/specs/registry-showroom/spec.md#requirement-barebones-mailing-examples)
defines identity and navigation behavior. These previews never send mail.

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

Emails use table layout and inline styles because they cannot inherit a website's
Tailwind stylesheet or CSS variables. `brand.theme` uses the existing semantic
roles with concrete values, including matching card and primary foregrounds.
Keep these values aligned with the host theme. Font stacks have local serif and
sans-serif fallbacks; remote fonts are not required. The default email is light
and remains self-contained. Inbox clients may apply their own dark-mode colors.
Browser previews do not certify every Outlook, Gmail or Apple Mail version.

Without `logoUrl`, the email shows the site's name without an image. Without
`theme`, it uses the renderer's default palette and system fonts. A partial theme
overrides only the supplied roles. A supplied logo still needs a URL that the
recipient's email client can reach.

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

## Change and preview a site's emails

In Seebach, [template.ts](https://github.com/the-factory-forge/osthoepathie-seebach/blob/968ecf0627d1f426c2e054c5108cba91a6abe20c/src/intranet/mailing/template.ts)
sets the clinic name, logo, colors, translated text and action links. Keep these
site settings outside installed Registry source.

To see the emails without sending them, run this from the Seebach checkout:

```sh
vp run preview:mailing
```

Open the generated `.cache/mailing/*.html` files in a browser and their `.txt`
alternatives in an editor. The [preview test](https://github.com/the-factory-forge/osthoepathie-seebach/blob/968ecf0627d1f426c2e054c5108cba91a6abe20c/src/intranet/mailing/template.test.ts)
lists the messages and languages to generate. It uses fake settings and tokens;
it needs no database or email credentials. Each site provides its own preview
command. Generated files stay ignored by Git and outside public routes.

The [Seebach preview instructions](https://github.com/the-factory-forge/osthoepathie-seebach/blob/968ecf0627d1f426c2e054c5108cba91a6abe20c/docs/mailing.md#preview-without-sending)
show how to serve the files locally so the logo appears too.

The [sender](https://github.com/the-factory-forge/osthoepathie-seebach/blob/968ecf0627d1f426c2e054c5108cba91a6abe20c/src/intranet/auth/verification-email.ts)
calls the same function as the preview, so both use the same layout and text.
The sender handles recipients, account tokens and delivery errors.

The [delivery test](https://github.com/the-factory-forge/osthoepathie-seebach/blob/968ecf0627d1f426c2e054c5108cba91a6abe20c/src/intranet/e2e/mailing-locales.spec.ts)
intercepts outgoing mail instead of delivering it. It compares every message and
language with the preview function and checks the recipient and action URL.

To check a logo in Gmail, its HTTPS address must be public. A `.localhost` image
can appear in your browser but not in Gmail. Check the logo again after deployment
and keep activation links pointed at the environment you are testing.

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
