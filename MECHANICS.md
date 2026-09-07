# MECHANICS — forge-registry (shared registry)

> **Repo** : forge-registry (shared Base UI component registry, 50 items) · **Branch** : main · **Status** : shared mechanics **available** through shadcn and the `@forge` namespace.
> This file documents what the registry OFFERS to sites (may be removed later since it is not a site project).
> **Legend** : ✅ available · ⚠️ partial · ➖ not provided
> **Distribution update** : 07.09.2026. Other historical notes below may need verification; see README and AGENTS for current usage.

## 1. Changelog (registry lifetime)

- **Foundation (historical)**: 46 initial items and UI framework shims.
- **Distribution**: 50 items including `back-office-sidebar` and the intranet additions. `registry:sync` uses the pinned official `shadcn build` for `public/r/`, with explicit file targets and `@forge` dependencies in the manifest. `tc-website` uses `shadcn add @forge/back-office-sidebar`. The legacy aggregate and `registry:pull` workflow are retired; existing consumers must migrate.
- **Components**: accordion (height keyframes on measured `--accordion-panel-height` — replaced janky grid-rows), reveal (useInView + post-hydration animate — was dead), not-found-page (themed: logo/icon/badge/dual CTAs/footnote), cookie-banner (selection always visible), navbar (`loginHref`), footer (forge attribution default), faq-list, sections (cta-band, trust, services-grid, testimonials, method-steps, pricing-table, contact-info), legal-page, theming/font presets + switchers.
- **SEO/perf items**: lazy image default, content-visibility, srcset props (home-hero/service-card), build-metadata (canonical/hreflang/OG), JSON-LD helpers.
- **Tooling**: Vite Plus 0.3.0 runs Oxlint and Oxfmt from `vite.config.ts`, with type-aware linting and type checking. Next.js keeps `dev`, `build`, and `start`; `typecheck` remains `tsc --noEmit`. Format and fix source before `registry:sync`; generated `public/r/` JSON is excluded from linting and formatting.
- **CI**: GitHub Actions `sync` (auto-manifest on push), `packageManager` pin (fixes pnpm/action-setup@v4), `permissions: contents: write`.
- **Lessons**: grid-rows never paints a `0fr` start frame (hidden + preflight display:none) → height keyframes; motion ignores `initial` after mount → useInView; source updates can replace site customizations → keep host adapters outside generated directories.

- **Intranet**: `intranet-shell` composes the existing `back-office-sidebar` with banner, topbar, and controls. The established sidebar API remains compatible with `tc-website`. `corner` and `corner-tokens` provide optional branding and require a consumer CSS import; the generic shell does not depend on them.
- **Portability**: `i18n-engine` ships dictionary helpers and locale configuration only. Next.js middleware stays in the showroom. Theme/font indexes reference only shipped presets (6 themes, including Corner, and 7 fonts).

## 2. Registry items (50)

| Category   | Item                                                            | Description                                                                    | Status |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| Libs       | `cn`                                                            | Class-name utility (cnfast re-export)                                          | ✅     |
| Libs       | `section-variants`                                              | SectionVariant type + color map                                                | ✅     |
| Libs       | `i18n-engine`                                                   | getDictionary + t()/tNode() dot-path resolver, locale config                   | ✅     |
| Libs       | `build-metadata`                                                | Canonical, hreflang (+x-default), Open Graph, Twitter, robots                  | ✅     |
| Libs       | `json-ld`                                                       | Organization/LocalBusiness, Breadcrumb, FAQ, Service schemas                   | ✅     |
| Libs       | `theme-presets`                                                 | Industry+mood presets (6 shipped, including Corner)                            | ✅     |
| Libs       | `font-presets`                                                  | 7 shipped presets                                                              | ✅     |
| UI         | `social-icons`                                                  | Inline SVG: IG, FB, LinkedIn, YouTube, X, TikTok, WhatsApp                     | ✅     |
| UI         | `animations`                                                    | FadeUp/FadeIn/ScaleIn/Stagger/HeroAnimation/ImageReveal                        | ✅     |
| UI         | `reveal`                                                        | Scroll-triggered fade-up (useInView + post-hydration — actually plays)         | ✅     |
| UI         | `share-button`                                                  | Web Share API + clipboard fallback                                             | ✅     |
| UI         | `back-to-top`                                                   | Floating scroll-to-top                                                         | ✅     |
| UI         | `section-heading`                                               | Eyebrow + title + subtitle                                                     | ✅     |
| UI         | `image-with-fallback`                                           | Image shim + error placeholder                                                 | ✅     |
| UI         | `lightbox`                                                      | Click-to-enlarge + Escape/overlay dismiss                                      | ✅     |
| UI         | `cta-button`                                                    | CtaLink + CtaExternal, 4 variants, 2 sizes                                     | ✅     |
| UI         | `breadcrumb`                                                    | Semantic breadcrumb, aria-current                                              | ✅     |
| UI         | `dropdown-menu`                                                 | Base UI menu (items/groups/separators/submenus)                                | ✅     |
| UI         | `sheet`                                                         | Base UI drawer (4 sides)                                                       | ✅     |
| UI         | `ui-shims`                                                      | Framework contracts (link/image/script/use-location) — site-provided by design | ⚠️     |
| UI         | `newsletter`                                                    | Email form with validation + aria-live states                                  | ✅     |
| UI         | `language-switcher`                                             | Locale dropdown preserving path                                                | ✅     |
| UI         | `manage-cookies-button`                                         | Reopens cookie banner                                                          | ✅     |
| UI         | `theme-provider` / `theme-switcher`                             | Preset tokens injection + preview switcher                                     | ✅     |
| UI         | `font-provider` / `font-switcher`                               | Font tokens + preview switcher                                                 | ✅     |
| Navigation | `back-office-sidebar`                                           | Customer identity, configurable navigation, profile, responsive toggle         | ✅     |
| Sections   | `navbar`                                                        | Sticky, dropdowns, mobile Sheet, switchers, CTA, loginHref                     | ✅     |
| Sections   | `footer`                                                        | Brand + columns + contact + socials + legal + newsletter + manage-cookies      | ✅     |
| Sections   | `home-hero`                                                     | 90vh hero, bg image, gradients, dual CTAs, backgroundPriority/srcSet           | ✅     |
| Sections   | `page-hero`                                                     | Inner hero + breadcrumb                                                        | ✅     |
| Sections   | `cta-band` / `trust-section` / `services-grid` / `service-card` | Composed sections, content-visibility                                          | ✅     |
| Sections   | `testimonials` / `method-steps` / `pricing-table`               | Composed sections                                                              | ✅     |
| Sections   | `faq-list`                                                      | Accordion FAQ with category filters                                            | ✅     |
| Sections   | `contact-info`                                                  | Contact + hours + lazy Google Maps embed                                       | ✅     |
| Sections   | `legal-page`                                                    | Legal prose layout, whitespace-pre-line                                        | ✅     |
| Layouts    | `cookie-banner`                                                 | Consent Mode v2, granular toggles, persistence, storage sync                   | ✅     |
| Layouts    | `not-found-page`                                                | Themed 404: logo, icon pastille, badge, dual CTAs, footnote                    | ✅     |
| Lib        | `footer-helpers`                                                | getFooterProps + placeholders + Corner attribution default                     | ✅     |
| Intranet   | `intranet-shell`                                                | Shared sidebar composition with optional banner, topbar, and controls          | ✅     |
| Intranet   | `corner-tokens`                                                 | Optional global Corner palette and signature CSS classes                       | ✅     |
| Intranet   | `corner`                                                        | CornerFrame, CornerLabel, and CornerRule                                       | ✅     |
| Tooling    | registry:sync / registry:check                                  | Official shadcn build / source JSON syntax check                               | ✅     |
| Tooling    | lint / format / check                                           | Vite Plus linting, formatting, and combined checks; fix variants available     | ✅     |
| Tooling    | CI auto-sync                                                    | GitHub Actions + packageManager + contents:write                               | ✅     |
| Docs       | README / CONTRIBUTING                                           | 50-item inventory, conventions, srcset rules, entry checklist                  | ✅     |

## 3. Gaps / notes

| #   | Note                                                                                                                                             | Tag  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1   | `corner-tokens` must be imported into the consumer's global Tailwind CSS and applies global brand variables; it is optional for `intranet-shell` | CORE |
| 2   | No Storybook or automated visual regression for registry items                                                                                   | PRO  |
| 3   | The default namespace tracks `main`; consumers can pin the URL to a commit for controlled updates                                                | PRO  |
| 4   | Shared UI uses adaptable framework shims; consumers provide router integration and locale routing                                                | CORE |
| 5   | No i18n-ready string linting (keys validated manually per site)                                                                                  | PRO  |
