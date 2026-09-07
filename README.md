# forge-registry

Shared registry of reusable React components, page sections, and utilities for use across different projects through shadcn's registry model. Consumers receive editable source files. The Next.js app in this repository is the development showroom.

The UI uses Base UI primitives, props-driven content, and framework shims. The registry also includes fr/en/de/it helpers; some supporting items still require Next.js integration (see below).

## Context for contributors and AI

Start with [AGENTS.md](./AGENTS.md) for project boundaries, source locations, the extraction workflow, and current limitations. [CONTRIBUTING.md](./CONTRIBUTING.md) covers component conventions.

The attached sibling project `../tc-website` is a reference, a source of components for extraction, and a consumer of the shared back-office sidebar. It uses TanStack Start/Router, React, Tailwind CSS, and shadcn Base UI. Extract selected components into this registry with reusable props, theme tokens, and declared dependencies; keep website-specific content and integrations in the consuming project. Attaching it does not initiate further migrations.

## What is included

- Next.js 16 (App Router) + React 19 showroom shell for previewing shared UI
- TypeScript strict with `@/components/forge/*` and `@/lib/forge/*` aliases for registry source files; `@/*` resolves showroom files
- Tailwind CSS v4 global styles (`@theme inline`, `@utility`)
- shadcn/ui initialization config (`/components.json`)
- motion (animations)
- Registry manifest (`/registry/registry.json`) and generated shadcn catalog and item endpoints in `/public/r/`

## Installing from the registry

`pnpm registry:sync` uses the pinned official shadcn CLI to build the catalog (`public/r/registry.json`) and installable items (`public/r/{name}.json`):

```bash
shadcn build registry/registry.json --output public/r
```

The source manifest declares file targets and `@forge/...` dependencies. Components install under the consumer's configured `components/forge/` directory; utilities install under `lib/forge/`, with reference content under `lib/forge/content/`. Source imports already match those paths; shadcn resolves the consumer's configured aliases.

Add this namespace to the consuming project's existing `components.json`:

```json
{
  "registries": {
    "@forge": "https://raw.githubusercontent.com/the-factory-forge/forge-registry/main/public/r/{name}.json"
  }
}
```

Then install an item from an initialized shadcn project:

```bash
pnpm dlx shadcn@4.19.1 add @forge/back-office-sidebar
```

For local development, run `pnpm registry:sync` and `pnpm dev` here. Temporarily set the consumer's `@forge` URL to `http://localhost:3000/r/{name}.json`, then run the same install command. The namespace routes both the requested item and its dependencies to the local server; no different build is needed. Restore the published URL before committing the consumer's configuration.

The [back-office sidebar guide](./docs/back-office-sidebar.md) covers props, toggles, Better Auth integration, and updating consumers. See the official [registry guide](https://ui.shadcn.com/docs/registry/getting-started) and [namespace configuration](https://ui.shadcn.com/docs/registry/namespace) for the distribution model.

After publishing changes to `main`, update the sidebar in `tc-website` with its consumer-owned command:

```bash
# In tc-website
pnpm registry:sidebar
```

This reruns shadcn with `--overwrite` for the sidebar and its registry dependencies. Shared fixes reach each website when it pulls the new source and deploys; they do not update running sites automatically. Keep site adapters outside generated `forge/` directories, and review the update diff before deploying.

The legacy aggregate endpoint (`public/registry/registry.json`) and `registry:pull` workflow are retired. Existing consumers such as `forge-template` must migrate to standard shadcn installs using `@forge`; this change does not migrate those projects automatically. Generating endpoints does not resolve missing imports, assets, or framework dependencies in unrelated items; review the limitations in [AGENTS.md](./AGENTS.md).

## Registry items (47)

The source of truth for this inventory is `registry/registry.json`.

### Libs (9)

| Name | Description |
|------|-------------|
| `cn` | Class-name utility (re-exports `cnfast`) |
| `section-variants` | Shared SectionVariant type and color map for themeable sections |
| `i18n-engine` | getDictionary, t(), locale middleware (fr/en/de/it) |
| `build-metadata` | Canonical, hreflang, Open Graph, Twitter cards |
| `json-ld` | Organization, Breadcrumb, FAQ, Service schemas |
| `theme-presets` | Industry + mood based theme preset system with 5 starter presets |
| `font-presets` | Category/family based font preset system with 7 shipped presets (13 in source) |
| `privacy-content` | Reference privacy-policy content in fr/en/de/it for site adaptation |
| `footer-helpers` | Builds footer props from site data, including attribution defaults |

### UI Primitives (21)

| Name | Description |
|------|-------------|
| `social-icons` | Inline SVG icons: Instagram, Facebook, LinkedIn, YouTube |
| `accordion` | Base UI accordion with a bundled animation stylesheet |
| `animations` | FadeUp, FadeIn, ScaleIn, StaggerContainer, HeroAnimation, ImageReveal |
| `reveal` | Scroll-triggered fade-up (useInView + post-hydration animate - actually plays) |
| `share-button` | Web Share API + clipboard fallback |
| `back-to-top` | Floating scroll-to-top button |
| `section-heading` | Eyebrow + title + subtitle, alignment and inverted variants |
| `image-with-fallback` | Image (shim) with error placeholder |
| `lightbox` | Click-to-enlarge image with overlay |
| `cta-button` | CtaLink + CtaExternal, 4 variants, 2 sizes |
| `breadcrumb` | Semantic breadcrumb navigation |
| `dropdown-menu` | Base UI dropdown menu |
| `sheet` | Base UI slide-out panel (drawer) |
| `ui-shims` | Framework shims: link/image/script/use-location (every site must install this item) |
| `newsletter` | Email signup form |
| `language-switcher` | Language selector dropdown |
| `manage-cookies-button` | Client-side button to reopen cookie banner |
| `theme-provider` | React context provider that applies a theme preset by injecting CSS custom properties |
| `theme-switcher` | Dropdown menu switcher for theme presets with color swatches |
| `font-provider` | React context provider that applies a font preset by injecting --font-sans and --font-heading CSS custom properties |
| `font-switcher` | Dropdown menu switcher for font presets, grouped by mood |

### Blocks (17)

| Name | Description |
|------|-------------|
| `cookie-banner` | GA4 Consent Mode v2 with localStorage |
| `navbar` | Responsive, dropdowns, mobile Sheet menu, language switcher, CTA |
| [back-office-sidebar](./docs/back-office-sidebar.md) | Customer branding, configurable nested navigation, user profile, and responsive built-in or external toggle |
| `footer` | Multi-column with brand, contact, socials, legal links |
| `home-hero` | Full-viewport hero with image, gradient, CTA |
| `page-hero` | Inner page hero with breadcrumb |
| `cta-band` | Full-width CTA banner |
| `trust-section` | Trust/expertise icon grid |
| `service-card` | Service card with image, icon, hover effect |
| `services-grid` | Responsive grid of service cards |
| `faq-list` | Accordion FAQ with category filters |
| `testimonials` | Client testimonials |
| `method-steps` | Numbered steps with connecting line |
| `pricing-table` | Dynamic pricing table |
| `contact-info` | Contact details + hours + Google Maps embed |
| `legal-page` | Prose layout for legal pages |
| `not-found-page` | Themed 404: optional logo, icon pastille, badge, dual CTAs, foot line, `ctaClassName` |

## Design system

The file `src/styles/globals.css` defines:

- **CSS variables**: `--primary`, `--secondary`, `--accent`, `--muted`, `--border`, `--ring`, `--dark-foreground`
- **Dark mode**: via `prefers-color-scheme`
- **Custom utilities**: `container-premium` (responsive padding), `section-padding` (responsive vertical)
- **Fonts**: `font-sans` and `font-heading` (Montserrat by default)
- **Animation keyframes**: enter/exit with fade, zoom, and slide utilities

Components using `inverted` (e.g. `section-heading`) rely on `text-dark-foreground` and `font-heading`.

## Principles

1. **Props-driven UI**: site content and integration callbacks come via props; shared presets and reference content live in library items
2. **Portable UI**: no `next/*` imports in shared UI (link/image/script/pathname go through the `ui-shims` item); Base UI primitives. The `i18n-engine` item currently includes Next.js middleware and `server-only`, so not all supporting items are framework-independent
3. **Server Components by default**: `"use client"` only when necessary
4. **No non-overridable hardcoded text**: all labels are props with English defaults
5. **a11y**: semantic HTML, aria-labels, keyboard nav, focus states

### Framework shims (ui-shims item)

The shared UI never imports `next/link`, `next/image`, `next/script` or `next/navigation`.
It imports `@/components/forge/ui/{link,image,script,use-location}` instead — those files are
shipped by the `ui-shims` registry item. Consumers adapt them to their framework as needed:

| Shim | Next.js site | TanStack site |
|---|---|---|
| `link.tsx` | Adapt `next/link` | Adapt router Link, mapping `href` to `to` |
| `image.tsx` | Adapt `next/image` as needed | Plain `<img>` or site image component |
| `script.tsx` | Adapt `next/script`, including the `code` prop | Site script/head handling |
| `use-location.ts` | Expose `next/navigation` usePathname | Expose router `useLocation().pathname` |

The shipped defaults are minimal (`<a>`, `<img>`, `<script>`, and a pathname snapshot). Consumers must include `ui-shims` when required and review them for their routing, image, and script needs. Preserve the exported names and props when adapting them; a direct framework re-export is not always compatible.

## Registry workflow

1. Create reusable source files under `/registry/components/*`.
2. Add corresponding registry items to `/registry/registry.json`.
3. Ensure each registry entry includes a unique `name`, a valid `type` (`registry:ui`, `registry:block`, etc.), explicit file targets, and `@forge/...` registry dependencies.
4. Run `pnpm registry:sync` to build the shadcn catalog and items in `/public/r/` with the official CLI.
5. Check JSON syntax with `pnpm registry:check` and run `pnpm typecheck`. The JSON check does not validate schema compliance or consumer installation; verify each changed item's files, imports, and dependencies too.
6. Push to `main` — the GitHub Actions `sync` workflow rebuilds and commits the generated catalog and items in `public/r/`. Requirements: repo workflow permissions = **Read and write**, and `packageManager: pnpm@11.20.0` in `package.json` (required by `pnpm/action-setup@v4`).
7. Pull the changed item into each consumer and validate its integration. For the sidebar in `tc-website`, use `pnpm registry:sidebar`.

## Scripts

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript verification
pnpm registry:check   # Parse source registry JSON (syntax only)
pnpm registry:sync    # Official shadcn catalog and item build
```

## Project structure

```
registry/              ← Distributed UI, utilities, and reference content
  components/
    ui/             # Primitives (cta-button, section-heading, animations...)
    navigation/     # back-office-sidebar, navbar, footer, language/theme/font switchers
    sections/       # home-hero, services-grid, faq-list, testimonials...
    layouts/        # cookie-banner, not-found-page
    forms/          # newsletter, newsletter-example
  lib/
    utils.ts        # cn()
    section-variants.ts  # Shared SectionVariant type
    themes/         # Theme preset data (index.ts + presets/*.json)
    fonts/          # Font preset data (index.ts + presets/*.json)
    seo/            # build-metadata, json-ld
  content/          # Reference content for site adaptation
  registry.json     # Source manifest (47 items)
src/                  ← Next.js showroom plus the shipped i18n-engine files
  app/              # Demo pages (home, newsletter...)
  lib/i18n/         # Dictionaries (shipped via the `i18n-engine` item, project-specific)
  styles/globals.css     # Design system
  middleware.ts     # Next.js locale detection + redirect (shipped in i18n-engine)
public/
  r/
    registry.json   # shadcn catalog
    {name}.json     # Official shadcn output with forge/ targets and @forge dependencies
docs/
  back-office-sidebar.md # Usage, host integration, and updates
```

## Adding a new component

See [CONTRIBUTING.md](./CONTRIBUTING.md) for conventions and component checklist.
