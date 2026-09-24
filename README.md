# forge-registry

Shared registry of reusable React components, page sections, and utilities for use across different projects through shadcn's registry model. Consumers receive editable source files. The TanStack Start app in this repository is the development showroom. Its foundation follows [Cove](https://github.com/mugnavo/cove) directly; it has no dependency on forge-template. See the [showroom architecture and migration guide](./docs/showroom.md).

The UI uses Base UI primitives, props-driven content, and framework shims. The registry also includes an intranet layout for internal websites. The showroom owns its locale configuration and dictionaries.

## Context for contributors and AI

Start with [AGENTS.md](./AGENTS.md) for project boundaries, source locations, the extraction workflow, and current limitations. [CONTRIBUTING.md](./CONTRIBUTING.md) covers component conventions.

The attached sibling project `../tc-website` is a reference, a source of components for extraction, and a consumer of the shared intranet sidebar. It uses TanStack Start/Router, React, Tailwind CSS, and shadcn Base UI. Extract selected components into this registry with reusable props, theme tokens, and declared dependencies; keep website-specific content and integrations in the consuming project. Attaching it does not initiate further migrations.

## What is included

- TanStack Start + Router, React 19, and Nitro showroom shell for previewing shared UI
- TypeScript strict with `@/components/*`, `@/components/pages/*`, `@/components/layouts/*`, and `@/components/utils/*` aliases for registry source files; `@/*` resolves showroom files
- Vite Plus 0.3.3 for linting and formatting, configured in `vite.config.ts`
- Tailwind CSS v4 global styles (`@theme inline`, `@utility`)
- shadcn/ui initialization config (`/components.json`)
- motion (animations)
- Registry manifest (`/registry/registry.json`) and generated shadcn catalog and item endpoints in `/public/r/`

## Installing from the registry

`pnpm registry:sync` uses the pinned official shadcn CLI to build the catalog (`public/r/registry.json`) and installable items (`public/r/{name}.json`):

```bash
shadcn build registry/registry.json --output public/r
```

The source manifest declares file targets and `@forge/...` dependencies. Rendered components install directly under the consumer's configured components directory, page-building sections with `page-*` names under `components/pages/`, layouts under `components/layouts/`, and non-visual utilities under `components/utils/`. Source imports mirror those targets; shadcn resolves the consumer's configured aliases.

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
pnpm dlx shadcn@4.19.1 add @forge/intranet-sidebar
```

For local development, run `pnpm registry:sync` and `pnpm dev` here. Temporarily set the consumer's `@forge` URL to `http://localhost:3000/r/{name}.json`, then run the same install command. The namespace routes both the requested item and its dependencies to the local server; no different build is needed. Restore the published URL before committing the consumer's configuration.

The [intranet sidebar guide](./docs/intranet-sidebar.md) covers props, toggles, Better Auth integration, and updating consumers. See the official [registry guide](https://ui.shadcn.com/docs/registry/getting-started) and [namespace configuration](https://ui.shadcn.com/docs/registry/namespace) for the distribution model.

After publishing changes to `main`, update the sidebar in `tc-website` with its consumer-owned command:

```bash
# In tc-website
pnpm registry:sidebar
```

This reruns shadcn with `--overwrite` for the sidebar and its registry dependencies. Shared fixes reach each website when it pulls the new source and deploys; they do not update running sites automatically. Keep site adapters outside registry-managed component paths, and review the update diff before deploying.

The legacy aggregate endpoint (`public/registry/registry.json`) and `registry:pull` workflow are retired. Consumers still using these must migrate to standard shadcn installs using `@forge`. The template installs the [FAQ and Contact pages](./docs/faq-contact.md) and [legal pages](./docs/legal-pages.md) through this namespace. Generating endpoints does not resolve missing imports, assets, or framework dependencies in unrelated items; review the limitations in [AGENTS.md](./AGENTS.md).

## Registry items (56)

The source of truth for this inventory is `registry/registry.json`.

Internal i18n helpers, locale dictionaries, and their
providers live under `src/lib/`. Showroom controls live under
`src/showroom/`. Neither directory is published through the registry; consumers
supply their own translations and theme configuration.

### Libs (7)

| Name                | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `consent-analytics` | Consent-driven Google Analytics and Ads loading, event gating, and retry |
| `cn`                | Class-name utility (re-exports `cnfast`)                                 |
| `section-variants`  | Shared SectionVariant type and color map for themeable sections          |
| `build-metadata`    | Canonical, hreflang, Open Graph, Twitter cards                           |
| `json-ld`           | Organization, Breadcrumb, FAQ, Service schemas                           |
| `privacy-content`   | Reference privacy-policy content in fr/en/de/it for site adaptation      |
| `footer-helpers`    | Builds footer props from site data, including attribution defaults       |

### UI Primitives (18)

| Name                    | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `auth-controls`         | Google sign-in, sign-out, and shared authentication action state                    |
| `social-icons`          | Inline SVG icons: Instagram, Facebook, LinkedIn, YouTube                            |
| `accordion`             | Base UI accordion with a bundled animation stylesheet                               |
| `animations`            | FadeUp, FadeIn, ScaleIn, StaggerContainer, HeroAnimation, ImageReveal               |
| `reveal`                | Scroll-triggered fade-up (useInView + post-hydration animate - actually plays)      |
| `share-button`          | Web Share API + clipboard fallback                                                  |
| `back-to-top`           | Floating scroll-to-top button                                                       |
| `section-heading`       | Eyebrow + title + subtitle, alignment and inverted variants                         |
| `image-with-fallback`   | Image (shim) with error placeholder                                                 |
| `lightbox`              | Click-to-enlarge image with overlay                                                 |
| `cta-button`            | CtaLink + CtaExternal, 4 variants, 2 sizes                                          |
| `breadcrumb`            | Semantic breadcrumb navigation                                                      |
| `dropdown-menu`         | Base UI dropdown menu                                                               |
| `sheet`                 | Base UI slide-out panel (drawer)                                                    |
| `ui-shims`              | Framework shims: link/image/script/use-location (every site must install this item) |
| `newsletter`            | Email signup form                                                                   |
| `language-switcher`     | Language selector dropdown                                                          |
| `manage-cookies-button` | Client-side button to reopen cookie banner                                          |

### Blocks (19)

| Name                                           | Description                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [page-faq](./docs/faq-contact.md)              | Complete FAQ page with hero, category filters, and accessible answers                                       |
| [page-contact](./docs/faq-contact.md)          | Complete Contact page with hero, details, hours, social links, and optional map                             |
| `cookie-banner`                                | Compact custom selection, accept all, saved consent, and host analytics callback                            |
| `navbar`                                       | Responsive, dropdowns, mobile Sheet menu, language switcher, CTA                                            |
| [intranet-sidebar](./docs/intranet-sidebar.md) | Customer branding, configurable nested navigation, user profile, and responsive built-in or external toggle |
| `footer`                                       | Multi-column with brand, contact, socials, legal links                                                      |
| `page-home-hero`                               | Full-viewport hero with image, gradient, CTA                                                                |
| `page-hero`                                    | Inner page hero with breadcrumb                                                                             |
| `page-cta-band`                                | Full-width CTA banner                                                                                       |
| `page-trust-section`                           | Trust/expertise icon grid                                                                                   |
| `service-card`                                 | Service card with image, icon, hover effect                                                                 |
| `page-services-grid`                           | Responsive grid of service cards                                                                            |
| `page-faq-list`                                | Accordion FAQ with category filters                                                                         |
| `page-testimonials`                            | Client testimonials                                                                                         |
| `page-method-steps`                            | Numbered steps with connecting line                                                                         |
| `page-pricing-table`                           | Dynamic pricing table                                                                                       |
| `page-contact-info`                            | Contact details + hours + Google Maps embed                                                                 |
| [page-legal](./docs/legal-pages.md)            | Prose layout for legal pages                                                                                |
| `page-not-found`                               | Themed 404: optional logo, icon pastille, badge, dual CTAs, foot line, `ctaClassName`                       |

### Plugins (11)

| Name                                        | Description                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [blogs / blogs-storage](./docs/blogs.md)    | Multilingual Markdown articles, categories, publishing, and optional S3/PostgreSQL persistence |
| [menus / menus-storage](./docs/menus.md)    | Restaurant menu, staff editing, translated labels, and Better Auth/Drizzle persistence         |
| [drive / drive-storage](./docs/drive.md)    | Entity-scoped file browser and optional private S3/PostgreSQL persistence                      |
| [projects](./docs/projects.md)              | Customer-owned projects, embeddable lists, creation, and Details/Drive sections                |
| [customers](./docs/customers.md)            | Customer directory, About/Projects/Sync detail, and creation form with host-owned actions      |
| [login](./docs/intranet-auth.md)            | Login, password recovery/change, access-denied page, and auth layout                           |
| [employees](./docs/intranet-auth.md)        | Employee list, creation, editing, verification and account deletion                            |
| [employees-server](./docs/intranet-auth.md) | Validated Better Auth employee operations behind host authentication                           |

Install with `pnpm dlx shadcn@4.19.1 add @forge/customers`. Preview at `/en/customers`.

Plugins install under `@components/plugins/{name}`; their supporting files ship together.

### Intranet (1)

| Name             | Description                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `intranet-shell` | Full internal layout composed from `intranet-sidebar`, with optional banner, topbar, and controls |

Use **intranet** for the full internal website layout. The
[intranet guide](./docs/intranet.md) covers the shell and host integration.
Preview it at `/en/intranet`; `/en/intranet-sidebar` is the focused sidebar demo.

```bash
pnpm dlx shadcn@4.19.1 add @forge/intranet-shell
```

The [cookie banner guide](./docs/cookie-banner.md) covers consent controls,
host analytics integration, and updating existing installations.

## Design system

The file `src/styles/globals.css` defines:

- **CSS variables**: `--primary`, `--secondary`, `--accent`, `--muted`, `--border`, `--input`, `--ring`, chart/sidebar colors, and `--dark`/`--dark-foreground`
- **Dark mode**: system preference by default; explicit `.light`/`.dark` preview modes take precedence
- **Custom utilities**: `container-premium` (responsive padding), `section-padding` (responsive vertical)
- **Fonts**: `font-sans` and `font-serif` (Montserrat by default)
- **Animation keyframes**: enter/exit with fade, zoom, and slide utilities

Components using `inverted` (e.g. `section-heading`) rely on `text-dark-foreground` and `font-serif`.

## Principles

1. **Props-driven UI**: site content and integration callbacks come via props; supporting utilities and reference content live in registry items
2. **Portable UI**: no `next/*` imports in shared UI (link/image/script/pathname go through the `ui-shims` item); Base UI primitives. Each consumer supplies its own dictionaries, locale routing, and theme configuration
3. **Server Components by default**: `"use client"` only when necessary
4. **No non-overridable hardcoded text**: all labels are props with English defaults
5. **a11y**: semantic HTML, aria-labels, keyboard nav, focus states

### Framework shims (ui-shims item)

The shared UI never imports `next/link`, `next/image`, `next/script` or `next/navigation`.
It imports `@/components/{link,image,script}` and `@/components/utils/use-location` instead — those files are
shipped by the `ui-shims` registry item. Consumers adapt them to their framework as needed:

| Shim              | Next.js site                                   | TanStack site                             |
| ----------------- | ---------------------------------------------- | ----------------------------------------- |
| `link.tsx`        | Adapt `next/link`                              | Adapt router Link, mapping `href` to `to` |
| `image.tsx`       | Adapt `next/image` as needed                   | Plain `<img>` or site image component     |
| `script.tsx`      | Adapt `next/script`, including the `code` prop | Site script/head handling                 |
| `use-location.ts` | Expose `next/navigation` usePathname           | Expose router `useLocation().pathname`    |

The shipped defaults are minimal (`<a>`, `<img>`, `<script>`, and a pathname snapshot). Consumers must include `ui-shims` when required and review them for their routing, image, and script needs. Preserve the exported names and props when adapting them; a direct framework re-export is not always compatible.

## Registry workflow

1. Create reusable source files under `/registry/components/*`, using `pages/` for page-building sections, `layouts/` for arranging other elements, `plugins/` for cohesive feature UI, and `utils/` for shared non-visual code.
2. Add corresponding registry items to `/registry/registry.json`.
3. Ensure each registry entry includes a unique `name`, a valid `type` (`registry:ui`, `registry:block`, etc.), explicit file targets, and `@forge/...` registry dependencies.
4. Run `pnpm format && pnpm lint:fix`, review automatic edits, then `pnpm registry:sync` to rebuild the shadcn catalog and items from the final source.
5. Run `pnpm registry:check`, `pnpm test`, `pnpm typecheck`, and `pnpm check`. The JSON check does not validate schema compliance or consumer installation; verify each changed item's files, imports, and dependencies too.
6. Push to `main` — the GitHub Actions `sync` workflow rebuilds and commits the generated catalog and items in `public/r/`. Requirements: repo workflow permissions = **Read and write**, and `packageManager: pnpm@11.20.0` in `package.json` (required by `pnpm/action-setup@v4`).
7. Pull the changed item into each consumer and validate its integration. For the sidebar in `tc-website`, use `pnpm registry:sidebar`.

## Scripts

Vite Plus runs Oxlint and Oxfmt using `vite.config.ts`; linting includes type-aware
rules and type checking. TanStack Start uses Vite for development and builds, with Nitro serving the production output. Generated `public/r/` JSON is excluded from linting and formatting:
format source files first, then regenerate it with `pnpm registry:sync`.

```bash
pnpm dev              # TanStack Start / Vite dev server
pnpm build            # Start + Nitro output in .output/
pnpm start            # Nitro server (PORT defaults to 3000)
pnpm lint             # vp lint (type-aware, with type checking)
pnpm lint:fix         # vp lint --fix
pnpm format           # vp fmt
pnpm format:check     # vp fmt --check
pnpm check            # vp check (format, lint, and type checks)
pnpm fix              # vp check --fix
pnpm test             # Navigation and registry regression tests (Node 24+)
pnpm test:browser     # Browser regressions against a running showroom
pnpm typecheck        # tsc --noEmit
pnpm registry:check   # Parse source registry JSON (syntax only)
pnpm registry:sync    # Official shadcn catalog and item build
```

## Project structure

```
vite.config.ts
registry/
  components/
    *.tsx             # Rendered components
    layouts/          # Components whose purpose is arranging other elements
    plugins/          # Feature UI and its colocated supporting code
    utils/            # Non-visual helpers, data, hooks, providers, and styles
  registry.json       # Source manifest
src/
  routes/             # TanStack file routes and root shell
  lib/                # Internal i18n and providers and helpers
  showroom/           # Internal preview controls, theme control, and layout frame
  styles/globals.css  # Showroom design system
  router.tsx          # Fresh router per SSR request
  start.ts            # Showroom-only locale detection and redirect
  routeTree.gen.ts    # Generated route manifest (committed, not hand-edited)
public/
  r/
    registry.json     # shadcn catalog
    {name}.json       # Installable item endpoints
docs/
  intranet-sidebar.md
  intranet.md
```

## Adding a new component

See [CONTRIBUTING.md](./CONTRIBUTING.md) for conventions and component checklist.
