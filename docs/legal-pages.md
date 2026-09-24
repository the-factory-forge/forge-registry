# Legal pages

`@forge/page-legal` provides one presentation for Terms, Privacy, and Legal notice.
Preview these at `/en/legal/cgv`, `/en/legal/privacy`, and `/en/legal/mentions` in
the showroom. The example text is only for previewing the layout.

## Install and update

Configure the `@forge` namespace from [README](../README.md), then run:

```sh
pnpm exec shadcn add @forge/page-legal
```

This installs `components/pages/page-legal.tsx` and the `@forge/cn` dependency.
It uses Tailwind CSS 4 utilities and semantic theme tokens. It needs no typography
plugin, framework runtime, or showroom stylesheet. The host supplies the main
landmark, surrounding navigation, footer, fonts, and theme.

```tsx
import { LegalPage, type LegalSection } from "@/components/pages/page-legal";

const sections: LegalSection[] = [
  { title: "Publisher", content: "Example studio\nhello@example.test" },
];

<LegalPage
  title="Legal notice"
  updatedLabel="Last updated"
  updatedAt="24 September 2026"
  dateSeparator=": "
  intro="An optional introduction."
  sections={sections}
/>;
```

`LegalPageProps` exposes the page title, optional introduction, optional update
date and its label/separator, sections, and `className`. Section titles and content
are plain text. Line breaks are preserved; HTML and Markdown are not interpreted.
Dates are supplied and formatted by the host. Omitting `updatedAt` hides the date
and its label. Long words wrap within the readable column on narrow screens.

## Template integration

The template's `/{locale}/legal/cgv`, `/{locale}/legal/privacy`, and
`/{locale}/legal/mentions` routes import this component from
`src/components/pages/page-legal.tsx`. The template retains all legal text,
translations, dates, site constants, metadata, canonical URLs, and indexing rules.
Its route loaders and heads load the locale dictionary; installed registry files
do not depend on it. Existing footer and cookie-banner links keep their URLs.

After a shared change, run `pnpm registry:sync`, publish the generated item, then
update the template with `vpr registry:public-pages` or
`vpr ui add @forge/page-legal`. Review overwrites and preserve the host's `cn`
adapter. Validate the localized pages after updating. Generated source updates
do not change deployed websites automatically.
