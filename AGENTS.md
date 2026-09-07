# Project context for AI contributors

## Purpose and scope

`forge-registry` is a shared source registry for reusable React components, page
sections, and supporting utilities. The goal is to reuse these elements across
different projects through shadcn's registry model. Consumers receive source
files they can adapt; this repository is not a published runtime npm library.

The Next.js app in this repository is a showroom for developing and previewing
registry elements. Work on the reusable element first; keep example content and
site integration in the showroom or consuming project.

The attached sibling `../tc-website` is a reference and a source of components
for future extractions. Its presence is not a request to migrate components now.
When asked to extract one, implement the reusable version here. Changes to the
source website belong to tasks that request them. There is no workspace package
dependency between the two repositories; never import from the sibling project.
`intranet-sidebar` is extracted here and consumed by `tc-website` through
generated source files. See its guide before changing the shared contract.
Use `intranet` for the complete internal website layout. `intranet-shell`
composes the shared sidebar. Corner branding is an optional addition.

## Read first and source of truth

- [README.md](./README.md): overview, inventory, distribution, and commands.
- [CONTRIBUTING.md](./CONTRIBUTING.md): component, styling, and accessibility conventions.
- `registry/registry.json`: authoritative list of shipped items and files.
- `package.json`: build, validation, and formatting commands with pinned tool versions.
- `vite.config.ts`: Vite Plus lint and format settings; Next.js remains the app framework.
- [docs/intranet-sidebar.md](./docs/intranet-sidebar.md): sidebar props,
  toggle placement, Better Auth integration, and consumer updates.
- [docs/intranet.md](./docs/intranet.md): shell composition and optional Corner CSS.
- [MECHANICS.md](./MECHANICS.md): historical notes and known gaps; verify claims
  against current code. Those notes are not an instruction to fix every gap.

Inspect the existing item, its imports, and its consumers before adding a new
abstraction or duplicating a component. Preserve existing item names and public
props unless the requested change calls for a breaking change.

## Repository map

| Path                                                    | Role                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `registry/components/ui/`                               | Shared primitives, animations, providers, framework shims                |
| `registry/components/sections/`                         | Composed sections such as heroes, FAQs, and pricing                      |
| `registry/components/navigation/`, `layouts/`, `forms/` | Navigation, layout helpers, forms                                        |
| `registry/components/intranet/`                         | Intranet shell and optional Corner components                            |
| `registry/lib/`, `registry/content/`                    | Shared utilities, presets, SEO helpers, reference content                |
| `registry/registry.json`                                | Editable source manifest                                                 |
| `vite.config.ts`                                        | Vite Plus lint/format configuration                                      |
| `public/r/registry.json`, `public/r/{name}.json`        | Generated shadcn catalog and item endpoints; do not hand-edit            |
| `src/app/`                                              | Next.js showroom: home, newsletter, intranet-sidebar, and intranet demos |
| `src/styles/globals.css`                                | Showroom tokens, typography, animations, layout utilities                |
| `src/lib/i18n/`                                         | Dictionary helpers and locale config shipped by `i18n-engine`            |
| `src/middleware.ts`                                     | Showroom-only Next.js locale routing                                     |

The local stack is React 19, TypeScript strict, Tailwind CSS 4, Base UI, Lucide,
and Motion, hosted in Next.js 16. Use the pnpm version pinned in `package.json`.
Vite Plus 0.3.0 provides Oxlint and Oxfmt through `vite.config.ts`; `dev`, `build`,
and `start` continue to use Next.js. Lint settings enable type-aware rules and
type checking. `pnpm typecheck` remains the separate `tsc --noEmit` check.
Registry source imports use `@/components/forge/*` and `@/lib/forge/*`, mapped to
`registry/components/*` and `registry/lib/*`; `@/lib/forge/content/*` maps to
`registry/content/*`. The general `@/*` alias resolves `src/*`. Check
`tsconfig.json` before changing imports or introducing a new source directory.

## Reusable component contract

- Pass site content, links, images, labels, and integration callbacks as props.
  Keep branding, dictionaries, API calls, auth, and business data in the consumer.
  Default UI labels to English and allow translation through props.
- Export the component and its props type. Support `className` where applicable;
  merge classes with `cn` from `@/lib/forge/utils`. Reuse `SectionVariant` for themed sections.
- Use semantic Tailwind/shadcn tokens and existing Base UI primitives. Preserve
  keyboard interaction, focus states, semantic HTML, and responsive behavior.
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
4. Convert site imports to `@/components/forge/...` or `@/lib/forge/...` and framework APIs to the shim
   contract. Reuse the local Base UI primitives; preserve supported composition
   APIs such as `render` when adapting source components.
5. Register the complete dependency set, provide representative demo usage, and
   validate the result as described below. The reusable result must work without
   access to `tc-website`'s files, services, or providers.

## Distribution and validation

`pnpm registry:sync` runs the pinned official CLI:
`shadcn build registry/registry.json --output public/r`. The source manifest lists
50 items; only declared files and dependencies ship.

`public/r/registry.json` and `public/r/{name}.json` are official shadcn catalog
and item output. The manifest declares `@components/forge/`, `@lib/forge/`, and
`@lib/forge/content/` targets and `@forge/item-name` registry dependencies.
Source imports already match those locations; shadcn resolves the consumer's
configured aliases. `i18n-engine` installs dictionary helpers and locale
configuration into `@lib/i18n/`. Next.js middleware stays in the showroom; the
item does not depend on Next.js or `server-only`. Consumers own locale routing.

Consumers configure the `@forge` namespace in `components.json` with
`https://raw.githubusercontent.com/the-factory-forge/forge-registry/main/public/r/{name}.json`.
Install with `shadcn add @forge/item-name`. To test locally, run
`pnpm registry:sync` and `pnpm dev`, then temporarily set the consumer's `@forge`
URL to `http://localhost:3000/r/{name}.json`. This also routes dependencies to the
local server; no build environment override is required. Restore the published
namespace URL before committing consumer configuration.

The legacy aggregate endpoint (`public/registry/registry.json`) and
`registry:pull` workflow are retired. Consumers still using them, including
`forge-template`, must migrate to standard `@forge` shadcn installs; do not assume
those projects have already migrated. `tc-website` already provides
`pnpm registry:sidebar`, which runs its pinned shadcn CLI with
`add @forge/intranet-sidebar --yes --overwrite`. Fix shared behavior here,
publish the generated artifacts, then update and validate each consumer before
deploying. Source distribution does not push fixes into running websites
automatically. Keep host adapters outside generated `components/forge/` and
`lib/forge/` files so updates preserve them. See the
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

- `i18n-engine` does not provide framework routing or middleware. Keep those in the consumer.
- Some manifest dependencies still list `next` for shim-based UI, and some omit
  imported registry items such as `ui-shims`. Audit the selected item's imports.
- Theme/font indexes reference the shipped presets only (6 themes and 7 fonts).
  Keep indexes and manifest file lists aligned when adding a preset.
- `corner` includes `corner-tokens`, but consumers must import the installed CSS
  into their global Tailwind stylesheet. It applies global brand variables;
  keep it optional and out of the generic `intranet-shell` dependency set.
