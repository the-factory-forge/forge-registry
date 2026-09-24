# FAQ and Contact pages

`@forge/page-faq` and `@forge/page-contact` compose the template's page hero with
its FAQ or contact section. The existing `page-faq-list` and `page-contact-info`
items remain available separately. Preview the complete pages at `/en/faq` and
`/en/contact` in the showroom.

## Install and update

Configure the `@forge` namespace as described in [README](../README.md), then run:

```sh
pnpm exec shadcn add @forge/page-faq @forge/page-contact
```

The complete pages install at `components/pages/page-faq.tsx` and
`components/pages/page-contact.tsx`. Shadcn also installs the hero, breadcrumb,
section components, accordion and its CSS, social icons, utilities, and framework
shims. Review dependency overwrites, especially existing framework adapters.
Use the local registry namespace while developing, then restore the published
namespace before committing the consumer configuration.

The pages use Tailwind CSS 4 utilities and semantic theme tokens. Their spacing
does not require the showroom's `container-premium` or `section-padding` helpers.
The host supplies the surrounding main landmark, navbar, footer, and any theme
configuration. Keep routing, translations, SEO, and site constants outside the
installed files. There is no Contact form or submission service in these pages.

## Usage

```tsx
import { FaqPage } from "@/components/pages/page-faq";
import { ContactPage } from "@/components/pages/page-contact";

<FaqPage
  hero={{
    title: "Frequently asked questions",
    homeLabel: "Home",
    homeHref: "/en",
    breadcrumbs: [{ label: "FAQ", href: "/en/faq" }],
  }}
  faq={{
    title: "Your questions",
    allLabel: "All",
    items: [{ question: "How do we start?", answer: "Contact our team.", category: "Planning" }],
  }}
/>;

<ContactPage
  hero={{
    title: "Contact us",
    homeLabel: "Home",
    homeHref: "/en",
    breadcrumbs: [{ label: "Contact", href: "/en/contact" }],
  }}
  contact={{
    title: "Our studio",
    email: "hello@example.com",
    phone: "+41 22 555 01 23",
    hoursLabel: "Opening hours",
    hours: [{ label: "Monday–Friday", value: "09:00–18:00" }],
    mapPlaceholder: "Contact us for directions.",
  }}
/>;
```

`hero` accepts the existing `PageHeroProps`, including an optional
`linkComponent` with the registry's `href` contract, a translated
`breadcrumbLabel`, and `homeHref` for locale-preserving navigation.
`faq` accepts `FaqListProps`; `contact` accepts `ContactInfoProps`.
Both pages also accept `className`. The nested section props support their own
`className` and color variant.

FAQ categories come from the supplied questions. Two or more categories expose
filters; selecting one closes the open answer. Questions support keyboard
activation and Tab navigation. Supply `filterLabel` and
`emptyMessage` for translated filter and empty-state copy. The host generates
FAQ JSON-LD from the same items and owns localized metadata.

Contact details, hours, and social links are optional. Social links accept an
optional translated `label`. `mapsUrl` makes the address an external directions
link; `mapsEmbed` supplies a lazy iframe with its accessible `mapsTitle`. Without
an embed, `mapPlaceholder` fills that area. Map URLs and third-party consent
requirements belong to the host; the component does not grant consent.

## Template integration

The template's localized FAQ and Contact route files import these pages from
`src/components/pages/`. The routes retain their dictionaries, metadata, FAQ
JSON-LD, contact constants, and TanStack link adapter. Other public sections stay
at their existing paths until separately migrated.

After shared changes, regenerate with `pnpm registry:sync`, publish the generated
items, and update the template with `vpr registry:public-pages`. Review the source
diff and run the template's lint and relevant browser checks. Registry source
updates do not update an already deployed website.
