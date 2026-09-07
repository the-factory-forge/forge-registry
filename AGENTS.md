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

## Read first and source of truth

- [README.md](./README.md): overview, inventory, distribution, and commands.
- [CONTRIBUTING.md](./CONTRIBUTING.md): component, styling, and accessibility conventions.
- `registry/registry.json`: authoritative list of shipped items and files.
- `scripts/build-registry.mjs` and `package.json`: actual build behavior and commands.
- [MECHANICS.md](./MECHANICS.md): historical notes and known gaps; verify claims
  against current code. Those notes are not an instruction to fix every gap.

Inspect the existing item, its imports, and its consumers before adding a new
abstraction or duplicating a component. Preserve existing item names and public
props unless the requested change calls for a breaking change.

## Repository map

| Path | Role |
| --- | --- |
| `registry/components/ui/` | Shared primitives, animations, providers, framework shims |
| `registry/components/sections/` | Composed sections such as heroes, FAQs, and pricing |
| `registry/components/navigation/`, `layouts/`, `forms/` | Navigation, layout helpers, forms |
| `registry/lib/`, `registry/content/` | Shared utilities, presets, SEO helpers, reference content |
| `registry/registry.json` | Editable source manifest |
| `public/registry/registry.json` | Generated aggregate manifest with embedded file contents; do not hand-edit |
| `src/app/` | Next.js App Router showroom; currently home and newsletter demo pages |
| `src/styles/globals.css` | Showroom tokens, typography, animations, layout utilities |
| `src/lib/i18n/`, `src/middleware.ts` | Exception to the showroom boundary: shipped by `i18n-engine` |

The local stack is React 19, TypeScript strict, Tailwind CSS 4, Base UI, Lucide,
and Motion, hosted in Next.js 16. Use the pnpm version pinned in `package.json`.
Registry imports use `#/*`, mapped to `registry/*`. The local `@/*` alias searches
`registry/*` first, then `src/*`; check `tsconfig.json` rather than assuming it
only resolves to showroom code.

## Reusable component contract

- Pass site content, links, images, labels, and integration callbacks as props.
  Keep branding, dictionaries, API calls, auth, and business data in the consumer.
  Default UI labels to English and allow translation through props.
- Export the component and its props type. Support `className` where applicable;
  merge classes with `cn` from `#/lib/utils`. Reuse `SectionVariant` for themed sections.
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
4. Convert `@/` imports to registry imports and framework APIs to the shim
   contract. Reuse the local Base UI primitives; preserve supported composition
   APIs such as `render` when adapting source components.
5. Register the complete dependency set, provide representative demo usage, and
   validate the result as described below. The reusable result must work without
   access to `tc-website`'s files, services, or providers.

## Distribution and validation

The current `pnpm registry:sync` runs the custom build script. It reads only files
listed in `registry/registry.json`, embeds their content, and writes one aggregate
manifest at `public/registry/registry.json`. It maps `registry/...` paths to
`src/...` targets, leaves other paths unchanged, and does not rewrite imports,
resolve dependencies, or copy unlisted files.

Existing documentation refers to a consumer-owned `pnpm registry:pull` script
in `forge-template`; that script is not part of this repository or the attached
`tc-website`. Do not assume it exists in any new consumer. Direct shadcn item
installation is an intended distribution path, but this repository does not
currently generate individual item endpoints. Verify the installation flow before
advertising an install URL; see the [official shadcn registry guide](https://ui.shadcn.com/docs/registry/getting-started).

For component or manifest changes, run `pnpm registry:sync`,
`pnpm registry:check`, and `pnpm typecheck`. Use `pnpm lint` and `pnpm build` when
the changes affect application code or integration, and inspect relevant demo
states for visual changes. `registry:check` only parses JSON; it does not validate
the shadcn schema, dependency completeness, or installation in another project.
Report checks actually run and any blockers. Documentation-only changes need a
diff and factual/link review, without dependency installation or app builds.

Known limitations to verify when touching affected items:

- `i18n-engine` includes Next.js middleware and `server-only`; portability of the
  UI does not imply that every registry item works in every framework.
- Some manifest dependencies still list `next` for shim-based UI, and some omit
  imported registry items such as `ui-shims`. Audit the selected item's imports.
- Theme/font indexes import more preset JSON files than their manifest entries
  ship. Local compilation can pass while a consumer receives missing imports.
