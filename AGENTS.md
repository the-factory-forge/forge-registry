# Project context for AI contributors

## Shared color contract

Use the same semantic color names across forge-registry, forge-template, and
tc-website: background/foreground, card, popover, primary, secondary, muted,
accent, destructive and their foreground pairs; border, input, ring, chart-1
through chart-5, and sidebar colors. Keep the dark-surface pair `--dark` and
`--dark-foreground` for image overlays and permanently dark sections.

Define the default palette in the application's stylesheet with `light-dark()`
pairs and expose colors through `@theme inline` mappings. Keep `color-scheme:
light dark` on `:root` and explicit light/dark classes so system preferences,
saved modes, native controls, and production CSS agree. Native checkbox/radio
accents use `--primary`. New components use semantic utilities and must not
introduce separate palettes, inline color overrides, or dependencies on TC's
private `--brand-*` aliases. Those aliases remain local to tc-website.

The default palette matches TC: deep teal `#13343a` in light mode and pale blue
`#badede` in dark mode. Customer sites can change values without renaming tokens.
Keep typography, spacing, and radii independent of color changes. Verify both
modes, saved choices, system preferences, and portaled dialogs after theme edits.

## Purpose and scope

`forge-registry` is a shared source registry for reusable React components, page
sections, and supporting utilities. The goal is to reuse these elements across
different projects through shadcn's registry model. Consumers receive source
files they can adapt; this repository is not a published runtime npm library.

The TanStack Start app in this repository is a showroom for developing and previewing
registry elements. Work on the reusable element first; keep example content and
site integration in the showroom or consuming project.

The showroom follows upstream Cove directly (see [docs/showroom.md](./docs/showroom.md)).
Do not import, link, or synchronize its foundation from forge-template: templates
consume this registry, so depending on them here would create a circular relationship.

The attached sibling `../tc-website` is a reference and a source of components
for future extractions. Its presence is not a request to migrate components now.
When asked to extract one, implement the reusable version here. Changes to the
source website belong to tasks that request them. There is no workspace package
dependency between the two repositories; never import from the sibling project.
`intranet-sidebar` is extracted here and consumed by `tc-website` through
generated source files. See its guide before changing the shared contract.
Use `intranet` for the complete internal website layout. `intranet-shell`
composes the shared sidebar. TC-specific components, styles, and branding belong
in `tc-website`; this registry contains reusable components for multiple customers.

## Read first and source of truth

- [README.md](./README.md): overview, inventory, distribution, and commands.
- [CONTRIBUTING.md](./CONTRIBUTING.md): component, styling, and accessibility conventions.
- `registry/registry.json`: authoritative list of shipped items and files.
- `package.json`: build, validation, and formatting commands with pinned tool versions.
- `vite.config.ts`: Vite Plus lint and format settings; TanStack Start, React, Tailwind, and Nitro plugins run the showroom.
- [docs/intranet-sidebar.md](./docs/intranet-sidebar.md): sidebar props,
  toggle placement, Better Auth integration, and consumer updates.
- [docs/intranet.md](./docs/intranet.md): shell composition and host integration.
- [MECHANICS.md](./MECHANICS.md): historical notes and known gaps; verify claims
  against current code. Those notes are not an instruction to fix every gap.

Inspect the existing item, its imports, and its consumers before adding a new
abstraction or duplicating a component. Preserve existing item names and public
props unless the requested change calls for a breaking change.

## Repository map

| Path                                             | Role                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `registry/components/`                           | Rendered UI components installed at `@components/*`                                       |
| `registry/components/pages/`                     | Page-building sections with `page-*` names, installed at `@components/pages/*`            |
| `registry/components/layouts/`                   | Compositions that arrange other elements, installed at `@components/layouts/*`            |
| `registry/components/utils/`                     | Non-visual helpers, data, hooks, providers, and styles installed at `@components/utils/*` |
| `registry/registry.json`                         | Editable source manifest                                                                  |
| `vite.config.ts`                                 | Vite Plus lint/format configuration                                                       |
| `public/r/registry.json`, `public/r/{name}.json` | Generated shadcn catalog and item endpoints; do not hand-edit                             |
| `src/lib/`                                       | Internal i18n and providers and showroom helpers; never published                         |
| `src/showroom/`                                  | Internal preview controls, theme control, and layout frame; never published               |
| `src/routes/`                                    | TanStack Router showroom demos                                                            |
| `src/styles/globals.css`                         | Showroom tokens, typography, animations, and layout utilities                             |
| `src/start.ts`                                   | Showroom-only Start request middleware                                                    |

The local stack is React 19, TypeScript strict, Tailwind CSS 4, Base UI, Lucide,
and Motion, hosted in TanStack Start with Nitro. Use the pnpm version pinned in `package.json`.
Vite Plus 0.3.3 provides Vite, Oxlint, and Oxfmt through `vite.config.ts`;
`dev` and `build` use Start/Vite, and `start` runs `.output/server/index.mjs`. Lint settings enable type-aware rules and
type checking. `pnpm typecheck` remains the separate `tsc --noEmit` check.
Registry source imports mirror their install targets: `@/components/*`,
`@/components/pages/*`, `@/components/layouts/*`, and `@/components/utils/*`. TypeScript maps all four
to `registry/components/`; the general `@/*` alias resolves showroom files under
`src/*`. Check `tsconfig.json` before changing imports or introducing a new source directory.

## Reusable component contract

- Employee management is admin-only: both employee pages require the authenticated
  `currentUserRole` and render nothing for non-admins. Consumers must also guard all
  employee routes before loading data, hide employee navigation for non-admins, and
  keep reads and mutations behind fresh-session admin authorization. UI checks never
  replace the existing `createEmployeeService` server guard.
- Pass site content, links, images, labels, and integration callbacks as props.
  Keep branding, dictionaries, API calls, auth, and business data in the consumer.
  Default UI labels to English and allow translation through props.
- Use the exact, non-translatable attribution copy `Forged by The Corner Factory SA`
  whenever a footer credits The Corner Factory.
- Export the component and its props type. Support `className` where applicable;
  merge classes with `cn` from `@/components/utils/cn`. Reuse `SectionVariant` for themed sections.
- Use semantic Tailwind/shadcn tokens and existing Base UI primitives. Preserve
  keyboard interaction, focus states, semantic HTML, and responsive behavior.
- Use a modal or dialog for create/edit forms that remain short and easy to complete
  without navigation. When the form grows into many inputs, sections, nested data,
  or a multi-step workflow, use a dedicated `/{resource}/:id` page instead (`new`
  may be the creation ID). Do not force complex forms into dialogs or create pages
  for simple forms; tc-website's larger employee flow is an intentional page-based exception.
- Across all plugins, render edit/modify/rename actions with Lucide's `PencilIcon`
  and delete/remove actions with `Trash2Icon`, as icon-only controls using the
  existing button styles. Delete triggers keep their confirmation dialogs.
  Keep a translated `aria-label`, hide the decorative icon with `aria-hidden="true"`,
  and preserve visible keyboard focus and a usable hit area. Familiar action icons
  such as edit and delete do not need tooltips or native `title` hints; do not add
  tooltips to every icon control by default. Omit the employee enable/disable
  access action from the list.
  Use links for navigation and buttons for in-place actions. Form headings and
  save/confirmation buttons retain their visible text.
- Keep components compatible with server rendering. Add `"use client"` where
  hooks, events, or browser APIs require it; do not access browser globals during render.
- Keep framework imports out of shared UI. Use the `ui-shims` item for Link,
  Image, Script, and pathname access. Consumers adapt these implementations to
  their framework while preserving the registry's exported names and props
  (for example, mapping `href` to a router's `to`).
- Include every required source file, stylesheet, and asset in an item's files
  or declared registry dependencies. Declare external packages in `dependencies`;
  having them in this repository's `package.json` does not install them for consumers.
- Account for CSS dependencies such as `container-premium`, `section-padding`,
  font utilities, and theme tokens. The showroom's global CSS is not currently
  distributed as a registry item; a successful preview alone does not prove portability.

## Extracting a component from tc-website

Start in `../tc-website/src/components/` for shared compositions (for example,
`public-page-header.tsx`, `public-section-heading.tsx`, and `pill-badge.tsx`),
`src/components/ui/` for primitives, and `src/routes/` for usage. Inspect
`src/hooks/`, `src/styles.css`, `src/css/`, and `public/` for supporting code and
assets. Larger application modules live in `src/features/` and can require
substantial host integration; do not treat them as standalone UI automatically.
`../tc-website/registry/forge-bexio-customers/README.md` is an existing reference
for separating reusable feature code from website adapters.

1. Read that repository's `AGENTS.md` and the selected component, imports,
   callers, and relevant styles. Its stack is React 19 with TanStack Start/Router,
   Tailwind 4, and shadcn Base UI (`base-rhea`, `rsc: false`). Its router APIs and
   source aliases are different from this registry's.
2. Check this registry for an existing equivalent. Extend it when appropriate,
   or add a distinct item when the requested component serves a different purpose.
3. Extract the requested visual structure and behavior. Replace company copy,
   brand colors, route data, auth/server functions, and asset paths with props,
   semantic tokens, or consumer callbacks. Trace custom tokens in
   `../tc-website/src/styles.css`; do not copy its entire theme or app infrastructure.
4. Convert site imports to `@/components/...`, `@/components/pages/...`, `@/components/layouts/...`, or `@/components/utils/...` and framework APIs to the shim
   contract. Reuse the local Base UI primitives; preserve supported composition
   APIs such as `render` when adapting source components.
5. Register the complete dependency set, provide representative demo usage, and
   validate the result as described below. The reusable result must work without
   access to `tc-website`'s files, services, or providers.

## Shared showroom layout

Wrap examples in `ShowroomPreview` from `src/showroom/showroom-preview.tsx`.
Supply demo-specific `controls` and optional `navigation`; the shared frame owns
spacing, the always-expanded right settings sidebar (stacked above the preview
on mobile), keyboard entry, and header offsets.
Use its standard, narrow, or full width rather than per-route viewport math.
Light/Dark selection belongs to the shared header, persists across demos, and
has no System option. Do not restore the removed font control/provider. Use the
showroom guide for className overrides on portable pages; keep these concerns
out of shipped registry components.

## Showroom homepage requirement

Every new registry UI component or module must have a working showroom example
and an entry in the `examples` array in `src/routes/index.tsx`, the showroom root `/`.
Add both in the same change as the component. A dedicated demo route alone is
not enough: visitors must be able to find it from the homepage. Give the entry
an accurate title, category, description, and link to its example.

Verify the entry appears under All and its category filter, and that its link
opens the demo. Include representative interactions and error states where
applicable. Document non-visual helpers and server companions with their parent
component's linked example; never import server modules into browser previews.

## Distribution and validation

`pnpm registry:sync` runs the pinned official CLI:
`shadcn build registry/registry.json --output public/r`. The source manifest lists
54 items; only declared files and dependencies ship.

`public/r/registry.json` and `public/r/{name}.json` are official shadcn catalog
and item output. The manifest declares `@components/`, `@components/pages/`, `@components/layouts/`, and
`@components/utils/` targets and `@forge/item-name` registry dependencies.
Source imports match those locations; shadcn resolves the consumer's configured
aliases. Showroom i18n and providers live in `src/lib/`
and are not registry items. Shared components must not import from `src/lib/`
or `src/showroom/`. Consumers own locale routing, dictionaries, and themes.

Consumers configure the `@forge` namespace in `components.json` with
`https://raw.githubusercontent.com/the-factory-forge/forge-registry/main/public/r/{name}.json`.
Install with `shadcn add @forge/item-name`. To test locally, run
`pnpm registry:sync` and `pnpm dev`, then temporarily set the consumer's `@forge`
URL to `http://localhost:3000/r/{name}.json`. This also routes dependencies to the
local server; no build environment override is required. Restore the published
namespace URL before committing consumer configuration.

The legacy aggregate endpoint (`public/registry/registry.json`) and
`registry:pull` workflow are retired. Consumers still using them must migrate to standard `@forge` shadcn installs.
`forge-template` uses the namespace for FAQ and Contact pages; review its
`registry:public-pages` command and host adapters when updating those items. `tc-website` already provides
`pnpm registry:sidebar`, which runs its pinned shadcn CLI with
`add @forge/intranet-sidebar --yes --overwrite`. Fix shared behavior here,
publish the generated artifacts, then update and validate each consumer before
deploying. Source distribution does not push fixes into running websites
automatically. Keep host adapters outside registry-managed component paths so updates preserve them. See the
[official shadcn registry guide](https://ui.shadcn.com/docs/registry/getting-started).

For implementation changes, run `pnpm format && pnpm lint:fix` and review the
automatic edits. When registry source or its manifest changes, run
`pnpm registry:sync` after formatting; generated `public/r/` JSON is excluded
from the formatter and linter and must come from the official builder. Run
`pnpm registry:check`, `pnpm typecheck`, and `pnpm check` before handoff.
`pnpm check` combines formatting, linting, and type checks; `pnpm fix` applies
its available fixes. Use `pnpm build` when changes affect application code or
integration, and inspect relevant demo states for visual changes.

`registry:check` only parses JSON; it does not validate the shadcn schema,
dependency completeness, or installation in another project. When changing
distribution behavior, also check a shadcn consumer install. Report checks
actually run and any blockers. Documentation-only changes need formatting, a
diff, and factual/link review, without dependency installation or app builds.

Known limitations and integration boundaries to verify when touching affected items:

- Locale routing, dictionaries, and theme configuration belong to each consumer.
- Framework packages belong to the showroom only. Declare `@forge/ui-shims`
  for components using the shared Link/Image/Script/location contract; never add
  Next.js or TanStack runtime dependencies to framework-neutral registry items.
- Keep internal i18n, providers under `src/lib/`, with
  showroom controls under `src/showroom/`; do not register them.
  Shared helpers needed by consumers stay under `registry/components/utils/`.
