# MECHANICS — forge-registry (shared registry)

> **Repo** : forge-registry (shared Base UI component registry, 41 items) · **Branch** : main · **Status** : shared mechanics **available** through shadcn and the `@forge` namespace.
> This file documents what the registry OFFERS to sites (may be removed later since it is not a site project).
> **Legend** : ✅ available · ⚠️ partial · ➖ not provided
> **Distribution update** : 07.09.2026. Other historical notes below may need verification; see README and AGENTS for current usage.

## 1. Changelog (registry lifetime)

- **Foundation (historical)**: 46 initial items and UI framework shims.
- **Distribution**: 41 items including `intranet-sidebar` and the other intranet additions. `registry:sync` uses the pinned official `shadcn build` for `public/r/`, with explicit file targets and `@forge` dependencies in the manifest. `tc-website` uses `shadcn add @forge/intranet-sidebar`. The legacy aggregate and `registry:pull` workflow are retired; existing consumers must migrate.
- **Components**: accordion (height keyframes on measured `--accordion-panel-height` — replaced janky grid-rows), reveal (useInView + post-hydration animate — was dead), page-not-found (themed: logo/icon/badge/dual CTAs/footnote), cookie-banner (compact by default, custom selection on demand), navbar (`loginHref`), footer (forge attribution default), page-faq-list, sections (page-cta-band, page-trust-section, page-services-grid, page-testimonials, page-method-steps, page-pricing-table, page-contact-info), page-legal. Internal i18n, theme/font presets, and providers live under `src/lib/`; preview switcher components live under `src/showroom/`.
- **SEO/perf items**: lazy image default, content-visibility, srcset props (page-home-hero/service-card), build-metadata (canonical/hreflang/OG), JSON-LD helpers.
- **Tooling**: Vite Plus 0.3.3 runs Oxlint and Oxfmt from `vite.config.ts`, with type-aware linting and type checking. TanStack Start/Vite runs `dev` and `build`, with Nitro serving `start`; `typecheck` remains `tsc --noEmit`. Format and fix source before `registry:sync`; generated `public/r/` JSON is excluded from linting and formatting.
- **CI**: GitHub Actions `sync` (auto-manifest on push), `packageManager` pin (fixes pnpm/action-setup@v4), `permissions: contents: write`.
- **Lessons**: grid-rows never paints a `0fr` start frame (hidden + preflight display:none) → height keyframes; motion ignores `initial` after mount → useInView; source updates can replace site customizations → keep host adapters outside generated directories.

- **Intranet**: `intranet-shell` composes `intranet-sidebar` with banner, topbar, and controls. The host supplies its branding and site-specific styling.
- **Portability**: Consumers supply their own dictionaries, locale routing, and themes. The showroom keeps its i18n, theme/font presets, and providers in `src/lib/`, its preview switchers in `src/showroom/`, and its Start locale middleware in `src/start.ts`.

## 2. Registry items (41)

| Category   | Item                                                             | Description                                                                    | Status |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Libs       | `cn`                                                             | Class-name utility (cnfast re-export)                                          | ✅     |
| Libs       | `section-variants`                                               | SectionVariant type + color map                                                | ✅     |
| Libs       | `build-metadata`                                                 | Canonical, hreflang (+x-default), Open Graph, Twitter, robots                  | ✅     |
| Libs       | `json-ld`                                                        | Organization/LocalBusiness, Breadcrumb, FAQ, Service schemas                   | ✅     |
| UI         | `social-icons`                                                   | Inline SVG: IG, FB, LinkedIn, YouTube, X, TikTok, WhatsApp                     | ✅     |
| UI         | `animations`                                                     | FadeUp/FadeIn/ScaleIn/Stagger/HeroAnimation/ImageReveal                        | ✅     |
| UI         | `reveal`                                                         | Scroll-triggered fade-up (useInView + post-hydration — actually plays)         | ✅     |
| UI         | `share-button`                                                   | Web Share API + clipboard fallback                                             | ✅     |
| UI         | `back-to-top`                                                    | Floating scroll-to-top                                                         | ✅     |
| UI         | `section-heading`                                                | Eyebrow + title + subtitle                                                     | ✅     |
| UI         | `image-with-fallback`                                            | Image shim + error placeholder                                                 | ✅     |
| UI         | `lightbox`                                                       | Click-to-enlarge + Escape/overlay dismiss                                      | ✅     |
| UI         | `cta-button`                                                     | CtaLink + CtaExternal, 4 variants, 2 sizes                                     | ✅     |
| UI         | `breadcrumb`                                                     | Semantic breadcrumb, aria-current                                              | ✅     |
| UI         | `dropdown-menu`                                                  | Base UI menu (items/groups/separators/submenus)                                | ✅     |
| UI         | `sheet`                                                          | Base UI drawer (4 sides)                                                       | ✅     |
| UI         | `ui-shims`                                                       | Framework contracts (link/image/script/use-location) — site-provided by design | ⚠️     |
| UI         | `newsletter`                                                     | Email form with validation + aria-live states                                  | ✅     |
| UI         | `language-switcher`                                              | Locale dropdown preserving path                                                | ✅     |
| UI         | `manage-cookies-button`                                          | Reopens cookie banner                                                          | ✅     |
| Navigation | `intranet-sidebar`                                               | Customer identity, configurable navigation, profile, responsive toggle         | ✅     |
| Sections   | `navbar`                                                         | Sticky, dropdowns, mobile Sheet, switchers, CTA, loginHref                     | ✅     |
| Sections   | `footer`                                                         | Brand + columns + contact + socials + legal + newsletter + manage-cookies      | ✅     |
| Pages      | `page-home-hero`                                                 | 90vh hero, bg image, gradients, dual CTAs, backgroundPriority/srcSet           | ✅     |
| Pages      | `page-hero`                                                      | Inner hero + breadcrumb                                                        | ✅     |
| Pages      | `page-cta-band` / `page-trust-section` / `page-services-grid`    | Composed sections, content-visibility                                          | ✅     |
| Components | `service-card`                                                   | Reusable card consumed by page sections                                        | ✅     |
| Pages      | `page-testimonials` / `page-method-steps` / `page-pricing-table` | Composed sections                                                              | ✅     |
| Pages      | `page-faq-list`                                                  | Accordion FAQ with category filters                                            | ✅     |
| Pages      | `page-contact-info`                                              | Contact + hours + lazy Google Maps embed                                       | ✅     |
| Pages      | `page-legal`                                                     | Legal prose layout, whitespace-pre-line                                        | ✅     |
| Components | `cookie-banner`                                                  | Consent Mode v2, granular toggles, persistence, storage sync                   | ✅     |
| Pages      | `page-not-found`                                                 | Themed 404: logo, icon pastille, badge, dual CTAs, footnote                    | ✅     |
| Lib        | `footer-helpers`                                                 | getFooterProps + placeholders + Corner attribution default                     | ✅     |
| Intranet   | `intranet-shell`                                                 | Shared sidebar composition with optional banner, topbar, and controls          | ✅     |
| Tooling    | registry:sync / registry:check                                   | Official shadcn build / source JSON syntax check                               | ✅     |
| Tooling    | lint / format / check                                            | Vite Plus linting, formatting, and combined checks; fix variants available     | ✅     |
| Tooling    | CI auto-sync                                                     | GitHub Actions + packageManager + contents:write                               | ✅     |
| Docs       | README / CONTRIBUTING                                            | 41-item inventory, conventions, srcset rules, entry checklist                  | ✅     |

## 3. Gaps / notes

| #   | Note                                                                                              | Tag  |
| --- | ------------------------------------------------------------------------------------------------- | ---- |
| 1   | No Storybook or automated visual regression for registry items                                    | PRO  |
| 2   | The default namespace tracks `main`; consumers can pin the URL to a commit for controlled updates | PRO  |
| 3   | Shared UI uses adaptable framework shims; consumers provide router integration and locale routing | CORE |
| 4   | No i18n-ready string linting (keys validated manually per site)                                   | PRO  |
