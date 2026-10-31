# Contributing to forge-registry

Component conventions and checklist for the shared registry.

Keep TC-specific components, visual styling, and branding in `tc-website`.
Registry components must be reusable across customers.
Before extending the library or its demos, follow the
[barebones scope and confirmation rule](./AGENTS.md#barebones-scope-and-confirmation).

## Shared color contract

For theme, color or status changes, read the shared [UI contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md).
The host stylesheet owns palette values; components consume semantic roles.
Verify light/dark modes, saved choices, system preferences and portaled dialogs.
Keep typography, spacing and radii independent of color changes.

## Formatting and validation

Vite Plus 1.3.0 configures Oxlint and Oxfmt in `vite.config.ts`. Linting includes
type-aware rules and type checking; `pnpm typecheck` also runs `tsc --noEmit`.
TanStack Start uses Vite for development and builds; Nitro serves the production output.

After implementation, run `pnpm format && pnpm lint:fix` and review automatic
edits. Regenerate affected registry artifacts with `pnpm registry:sync`, then
run `pnpm registry:check`, `pnpm test`, `pnpm typecheck`, and `pnpm check`. The last command
checks formatting, lint, and types together; `pnpm fix` applies available fixes.
Generated `public/r/` JSON is excluded from linting and formatting, so rebuild it
after changing or formatting source files.

`pnpm install` enables the Git pre-commit hook; run `pnpm prepare` once in existing
checkouts. Stage or stash all `registry/` changes before committing. The hook runs
`pnpm registry:sync` and blocks the commit if generated files differ from the index,
new output files are untracked, or the build fails. It prints the next steps in the
commit output. Review and stage regenerated files with `git add public/r`, then retry.

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

Use the same CSS vocabulary as `forge-template` and `tc-website`:

- Typography: `font-sans` for body text, `font-serif` for headings, and
  `font-mono` for code. `font-serif` names the heading role; each website chooses
  its font family. Consumers define any `font-eyebrow` styling in their own CSS.
- Sidebar surfaces and navigation: `bg-sidebar`, `text-sidebar-foreground`,
  `border-sidebar-border`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`,
  `text-sidebar-primary`, and `ring-sidebar-ring`. Profile menus use
  `bg-popover` and `text-popover-foreground`.
- Layout helpers: `container-premium` and `section-padding`.

Use `text-destructive` for form errors. Status labels use the host's semantic
background and foreground pairs, with visible text so color is not the only cue:

| Meaning       | Token pair                                             | Color  |
| ------------- | ------------------------------------------------------ | ------ |
| Success       | `status-success` / `status-success-foreground`         | Green  |
| Pending       | `status-pending` / `status-pending-foreground`         | Orange |
| Not started   | `status-not-started` / `status-not-started-foreground` | Gray   |
| Canceled      | `status-canceled` / `status-canceled-foreground`       | Red    |
| Informational | `status-info` / `status-info-foreground`               | Blue   |

For example, `bg-status-success text-status-success-foreground` identifies Published.
Use gray for Draft and orange for Unpublished changes. Define these pairs with
`light-dark()` in the host stylesheet and map them through `@theme inline`, as
in [the showroom stylesheet](./src/styles/globals.css). Keep status colors
independent of the customer's primary color and readable in both themes.

## File placement

| Type                                                     | Source directory                      | Install target                 |
| -------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| Components that render their own UI                      | `registry/components/`                | `@components/*`                |
| Page-building sections; item and file names use `page-*` | `registry/components/pages/`          | `@components/pages/*`          |
| Layouts whose purpose is arranging other elements        | `registry/components/layouts/`        | `@components/layouts/*`        |
| Feature UI and its colocated types, labels, and helpers  | `registry/components/plugins/{name}/` | `@components/plugins/{name}/*` |
| Non-visual helpers, data, hooks, providers, and styles   | `registry/components/utils/`          | `@components/utils/*`          |

Internal i18n helpers, locale dictionaries, and their
providers belong in `src/lib/`. Showroom controls belong in
`src/showroom/`. Neither directory may be listed in `registry/registry.json` or
imported by shared registry components. Reusable connector source and provider adapters live under `registry/components/connectors/{name}/`
and install at `@components/connectors/{name}/*`. List connectors in the showroom
under **Connector**; server companions stay with their parent example.
Host adapters remain in the consuming website.
Plugin-specific supporting code stays with its plugin. Shared consumer-facing helpers remain in
`registry/components/utils/`.

## DOM IDs

Every DOM ID authored by registry or showroom code must start with `factory-`.
Use descriptive fixed IDs for singleton elements, such as `factory-cookie-banner`.
Use a prefixed React instance ID for reusable fields and sections:

```tsx
const id = `factory-customer-form-${useId()}`;
```

Keep `htmlFor`, ARIA references, fragment links, CSS selectors, and tests aligned
with the resulting IDs. Host adapters supplying a DOM ID to a transparent shim or
field component must also use this prefix; supplied values pass through unchanged.
Database/entity IDs, provider tracking IDs, and IDs generated internally by third-party
libraries retain their own contracts. The shared rule lives in forge-spec's
[Shared UI contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md).

The website screenshot CLI hides `#factory-cookie-banner` only during capture,
without accepting cookies or changing saved consent. Render one cookie banner per
page. Existing consumer sites must refresh the component and redeploy to receive
renamed IDs; their custom selectors must be updated alongside that refresh.

## Props conventions

- Every visible string is a prop with an English default value
- Components never import data — everything comes via props
- Use `cn()` from `@/components/utils/cn` for all className merging
- Export both the component and its Props type
- For section components that support color themes, use `SectionVariant` from `@/components/utils/section-variants`

## Form flow

Create and edit in a modal or dialog when the form is short enough to complete
comfortably without navigation. Use a dedicated `/{resource}/:id` page when the
flow has many inputs, sections, nested data, or multiple steps; `new` may be used
as the creation ID. Keep one form implementation for either presentation. TC's larger employee flow
is an intentional page-based exception.

Mark required labels with a visible `*` (`aria-hidden="true"`), preserving native
`required` or `aria-required`; leave optional fields unmarked. Keep UI copy brief
and helper text limited to constraints, consequences or recovery that the control
does not explain. Keep implementation details out of the user flow.

## Client/Server

Prefer Server Components. Add `"use client"` only when the component uses:

- `useState`, `useEffect`, `useRef`, `useCallback`
- Event handlers (`onClick`, `onChange`) that manage local state
- Browser APIs (`window`, `navigator`, `localStorage`)

## Accessibility

### Action icons

Follow the shared [action icon contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-consistent-action-icons)
when creating or modifying action toolbars. Refresh/reload uses `RefreshCwIcon`,
settings/configuration uses `SettingsIcon`, and new/create/add entry points use
`PlusIcon`, all from Lucide. Refresh controls are icon-only with a translated accessible name
and `IconTooltip`. Settings and create controls keep their translated visible
label, with the icon before it; omit duplicate tooltips for text buttons.
Use `size-4 shrink-0`, inherit the control's text color, and set `aria-hidden="true"`.
Keep existing button/link variants, focus styles and responsive wrapping.

Edit/rename and delete/remove retain the existing `PencilIcon` and `Trash2Icon`
icon-only convention, with translated accessible names and deletion confirmation.
Add `IconTooltip` to every icon-only action, including familiar edit/delete icons. Reuse the same icon for the same
action across plugins and hosts; do not add icons to every field or label.

### Button spacing

Follow the shared [button spacing contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-spacing-between-action-buttons).
Always leave at least `gap-1` between adjacent action buttons and button-styled
links. Prefer `gap-2` in toolbars and form actions. Use container gaps in both
directions so wrapped rows keep their spacing on mobile. Apply the same rule to
third-party controls, including calendar navigation and view selectors. Do not
join controls with touching borders or negative margins.

### Interaction requirements

Follow the shared [active-state contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-persistent-active-control-states).
Selected, pressed, current and expanded controls need a persistent visual state
distinct from inactive, including after hover/focus leaves. Reuse semantic tokens
and existing variants; keep focus visible, dimensions stable and the appropriate
native/ARIA state synchronized with the actual selection or panel visibility.
Ship this styling with the component and verify both themes and every reset/close path.

Place the primary status badge at the top right of a card or detail summary,
opposite its title, following the shared [status placement contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-status-badge-placement).
Allow long titles and translated labels to wrap without overlap. Table statuses
remain in their status column.

Follow the shared [button cursor contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md#requirement-button-pointer-cursors).
Enabled buttons use `cursor-pointer`; disabled controls use `cursor-not-allowed`.
Cover icon buttons, date cells and third-party controls, including their native,
ARIA and library-disabled states. Include cursor styles in the shipped component
or its declared stylesheet; the showroom's global rule is not distributed.

Every component must include:

- Semantic HTML elements (`<form>`, `<nav>`, `<section>`, `<button>`)
- Visible `focus-visible:ring-2 focus-visible:ring-ring` states
- `aria-*` attributes when state changes (e.g. `aria-invalid`, `aria-describedby`)
- `aria-label` and `IconTooltip` on every icon-only button and action link, using
  the same translated label. Tooltips open on hover and keyboard focus and close
  with Escape; native `title` alone is insufficient. Preserve disabled states and
  declare `@forge/icon-tooltip` in each importing registry item.
- `sr-only` labels where a visible label would be redundant
- `role="alert"` / `aria-live` for dynamic status messages

## Responsive images (srcset)

Components rendering display images must support responsive variants:

- The `Image` shim passes `srcSet`/`sizes` through; `ImageWithFallback` exposes a
  `srcSet` prop; `service-card` exposes `imageSrcSet`; `page-home-hero` exposes
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
      "path": "registry/components/my-component.tsx",
      "type": "registry:component",
      "target": "@components/my-component.tsx"
    }
  ],
  "dependencies": ["lucide-react"],
  "registryDependencies": ["@forge/cn"]
}
```

| Field                  | Notes                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                 | `registry:ui` for primitives, `registry:block` for composed sections, `registry:lib` for libraries                                                                   |
| `dependencies`         | npm packages the consumer must install                                                                                                                               |
| `registryDependencies` | Required registry items, using `@forge/item-name` for local items                                                                                                    |
| File `target`          | Use `@components/*`, `@components/pages/*`, `@components/layouts/*`, `@components/plugins/{name}/*`, or `@components/utils/*` according to the placement rules above |

Use `@/components/...`, `@/components/pages/...`, `@/components/layouts/...`, and
`@/components/utils/...` source imports to match those installation paths. The showroom's TypeScript aliases resolve them to `registry/`;
the shadcn CLI adapts them to each consumer's configured aliases.

Then run `pnpm registry:sync` to build the catalog and item endpoints with the
pinned official shadcn CLI. Consumers use the `@forge` namespace documented in
[README.md](./README.md).

## Component checklist

- [ ] Uses shadcn design tokens (no hardcoded colors)
- [ ] All strings are props with English defaults
- [ ] Imports `cn` from `@/components/utils/cn` for className merging
- [ ] `"use client"` only when necessary
- [ ] Props type is exported
- [ ] Accessible (semantic HTML, aria, focus rings, keyboard nav)
- [ ] Registry entry added to `registry/registry.json`
- [ ] Working showroom example added with representative interactions
- [ ] Composed components, page sections, layouts and plugins listed in `examples` in `src/showroom/examples.ts`; basic controls and feedback helpers stay out of the homepage list
- [ ] Homepage entry, when applicable, checked under All and its category filter, and its demo link verified
- [ ] Basic control and feedback demos linked from documentation or parent examples
- [ ] Non-visual helpers and server companions documented with the parent component's linked example
- [ ] Formatting and validation flow above completed; generated artifacts match the final source

Storage companions use a separate `plugins/{name}/server` entrypoint and registry item. Browser entrypoints must never export server modules. Declare server packages only on the companion; ship migration/configuration templates explicitly, without applying them during installation. See [Drive](./docs/drive.md).

## Plugin contracts

Use the [plugin guide](./docs/plugins.md) and registry-owned [Plugins specification](openspec/specs/plugins/spec.md)
for the feature definition, module capabilities and host boundaries. Keep them
aligned with exported contracts, the manifest and each integration guide when
adding or changing a plugin.

## Runtime validation

Always use Zod to validate external inputs at trust boundaries, including plugin
service requests, URL parameters, form payloads and configuration. Parse before
accessing fields or performing side effects, and use the parsed output with unknown
fields stripped or rejected. Reuse existing schemas, preserve documented defaults
and optional-field semantics, and map failures to the existing plugin error codes.
Keep authorization and business rules explicit alongside schema validation. When
adding or changing a boundary, test malformed inputs and declare Zod in every
registry item that imports it. See [service input validation](docs/plugins.md#service-input-validation).

## Host and security boundaries

Employee pages require authenticated `currentUserRole` and render nothing for
non-admins. Hosts guard routes before loading data, hide employee navigation from
non-admins and keep reads/mutations behind fresh-session admin authorization.
UI checks never replace `createEmployeeService`'s server guard. Omit the employee
enable/disable access action from the list; retain deletion confirmation.

Every visible Corner attribution, including auth screens, uses the exact
non-translatable copy `Forged by The Corner Factory SA`, with the official `c`
logo on its left. Reuse `https://assets.the-corner.io/logos/the_corner-icon.svg`
with decorative alt text and contrast in both themes.

Keep framework imports out of shared UI. Use `ui-shims` for Link, Image, Script
and pathname access. Hosts adapt these to their framework without changing
exported names or props. Keep browser globals out of render for SSR compatibility.

Declare every source file, stylesheet, asset and dependency needed by the item;
packages in the showroom's `package.json` do not install into consumers. Account
for `container-premium`, `section-padding`, fonts and tokens. Showroom global CSS
is not distributed as a registry item. Follow [layout stability](DESIGN.md#layout-stability)
for pending, empty, error and feedback states, and verify persistent element positions.
