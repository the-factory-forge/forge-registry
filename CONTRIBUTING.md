# Contributing to forge-registry

Component conventions and checklist for the shared registry.

## Formatting and validation

Vite Plus 0.3.0 configures Oxlint and Oxfmt in `vite.config.ts`. Linting includes
type-aware rules and type checking; `pnpm typecheck` also runs `tsc --noEmit`.
Next.js continues to run the showroom's dev server, build, and production server.

After implementation, run `pnpm format && pnpm lint:fix` and review automatic
edits. Regenerate affected registry artifacts with `pnpm registry:sync`, then
run `pnpm registry:check`, `pnpm typecheck`, and `pnpm check`. The last command
checks formatting, lint, and types together; `pnpm fix` applies available fixes.
Generated `public/r/` JSON is excluded from linting and formatting, so rebuild it
after changing or formatting source files.

## Design tokens

Always use shadcn semantic tokens. Never hardcode colors.

```tsx
// Correct
className = "border border-border bg-background text-foreground";
className = "text-muted-foreground";
className = "bg-primary text-primary-foreground hover:bg-primary/90";
className = "focus-visible:ring-2 focus-visible:ring-ring";

// Wrong
className = "border border-zinc-300 bg-white text-zinc-950";
className = "text-zinc-600 dark:text-zinc-400";
```

Tokens: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `focus-visible:ring-ring`, `bg-muted`, `bg-accent`, `text-accent-foreground`, `bg-secondary`, `text-secondary-foreground`.

Error/success feedback can use utility colors (`text-red-600`, `text-emerald-700`) as they are semantic, not theme-dependent.

## File placement

| Type                                     | Directory                         |
| ---------------------------------------- | --------------------------------- |
| UI primitives (button, input, badge…)    | `registry/components/ui/`         |
| Page sections (hero, grid, faq…)         | `registry/components/sections/`   |
| Navigation (navbar, footer…)             | `registry/components/navigation/` |
| Layout helpers (cookie banner, consent…) | `registry/components/layouts/`    |
| Forms (newsletter…)                      | `registry/components/forms/`      |
| Libraries (utils, i18n, seo…)            | `registry/lib/`                   |

## Props conventions

- Every visible string is a prop with an English default value
- Components never import data — everything comes via props
- Use `cn()` from `@/lib/forge/utils` for all className merging
- Export both the component and its Props type
- For section components that support color themes, use `SectionVariant` from `@/lib/forge/section-variants`

## Client/Server

Prefer Server Components. Add `"use client"` only when the component uses:

- `useState`, `useEffect`, `useRef`, `useCallback`
- Event handlers (`onClick`, `onChange`) that manage local state
- Browser APIs (`window`, `navigator`, `localStorage`)

## Accessibility

Every component must include:

- Semantic HTML elements (`<form>`, `<nav>`, `<section>`, `<button>`)
- Visible `focus-visible:ring-2 focus-visible:ring-ring` states
- `aria-*` attributes when state changes (e.g. `aria-invalid`, `aria-describedby`)
- `aria-label` on icon-only buttons
- `sr-only` labels where a visible label would be redundant
- `role="alert"` / `aria-live` for dynamic status messages

## Responsive images (srcset)

Components rendering display images must support responsive variants:

- The `Image` shim passes `srcSet`/`sizes` through; `ImageWithFallback` exposes a
  `srcSet` prop; `service-card` exposes `imageSrcSet`; `home-hero` exposes
  `backgroundSrcSet`.
- Variant convention: `<name>-480.webp` / `<name>-800.webp` generated from the
  source with `scripts/generate-image-variants.mjs` in the **forge-template**
  repo
  (480 at q90, 800 at q80 by convention — quality is per-site).
- **The srcSet must ALWAYS end with the ORIGINAL file as the top-width
  candidate** (e.g. `, /images/hero.webp 1200w`). Browsers pick the largest
  srcset candidate when all are too small — they never fall back to `src` —
  omitting the native width makes desktop/retina receive an upscaled (blurry)
  variant.
- `priority` (eager + high fetch priority) is reserved for the actual LCP
  element. Decorative/non-LCP images above the fold should NOT be priority.

## Registry entry

After creating a component, add it to `registry/registry.json`:

```json
{
  "name": "my-component",
  "type": "registry:ui",
  "title": "My Component",
  "description": "Short description of what it does.",
  "files": [
    {
      "path": "registry/components/ui/my-component.tsx",
      "type": "registry:component",
      "target": "@components/forge/ui/my-component.tsx"
    }
  ],
  "dependencies": ["lucide-react"],
  "registryDependencies": ["@forge/cn"]
}
```

| Field                  | Notes                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `type`                 | `registry:ui` for primitives, `registry:block` for composed sections, `registry:lib` for libraries |
| `dependencies`         | npm packages the consumer must install                                                             |
| `registryDependencies` | Required registry items, using `@forge/item-name` for local items                                  |
| File `target`          | Explicit consumer destination; use `@components/forge/`, `@lib/forge/`, or `@lib/forge/content/`   |

Use `@/components/forge/...` and `@/lib/forge/...` source imports to match those
installation paths. The showroom's TypeScript aliases resolve them to `registry/`;
the shadcn CLI adapts them to each consumer's configured aliases.

Then run `pnpm registry:sync` to build the catalog and item endpoints with the
pinned official shadcn CLI. Consumers use the `@forge` namespace documented in
[README.md](./README.md).

## Component checklist

- [ ] Uses shadcn design tokens (no hardcoded colors)
- [ ] All strings are props with English defaults
- [ ] Imports `cn` from `@/lib/forge/utils` for className merging
- [ ] `"use client"` only when necessary
- [ ] Props type is exported
- [ ] Accessible (semantic HTML, aria, focus rings, keyboard nav)
- [ ] Registry entry added to `registry/registry.json`
- [ ] Example usage provided (optional but recommended)
- [ ] Formatting and validation flow above completed; generated artifacts match the final source
