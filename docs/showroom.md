# Showroom architecture

The showroom uses TanStack Start and Router, React, Vite+, Tailwind's Vite plugin,
and Nitro. Its framework foundation was adapted directly from Cove under the
Unlicense and reconciled through
[revision ebd3e81](https://github.com/mugnavo/cove/tree/ebd3e81a9fa91ba2f4c040012e3f3925352c16bf).
The application keeps its own dependencies and configuration. Cove provides the
upstream reference for selective foundation updates.

There is no import, workspace link, or build dependency on `forge-template` or
`tc-website`. Both can consume generated registry source without a circular
dependency. Future framework updates belong here and can be reviewed against
upstream Cove independently of those consumers.

## Boundaries

- `registry/` contains portable source and its shadcn manifest. Neither Start nor
  Next.js is required by its UI items. The default Link/Image/Script/location
  shims remain framework independent.
- `src/routes/` contains file routes. `__root.tsx` owns the document, metadata,
  stylesheet, shared header, and not-found view. `index.tsx` contains the showroom
  example directory for composed components, page sections, layouts and plugins.
  Keep basic controls and feedback helpers out of this list; link their demos
  from documentation or parent examples.
- `src/router.tsx` creates a router per request. The Start Vite plugin generates
  `src/routeTree.gen.ts`; commit that generated file after route changes so a fresh
  checkout can typecheck before starting Vite. Do not edit it manually.
- `src/showroom/routing.tsx` adapts the published `href` contract to TanStack
  navigation, including search parameters and hashes. It is never distributed.
- Pathless `_plugins` and `_blogs` routes retain mock providers across their child
  pages. Customers/projects/Drive share their in-memory records; blogs retain
  publications when switching between administration, public pages, and languages.
  Reloading resets demo data, as before.
- `src/start.ts` applies locale redirects to unlocalized demo routes. Existing
  `NEXT_LOCALE` cookies remain readable; new cookies use `FORGE_LOCALE`. Registry
  JSON, static assets, the homepage, newsletter, and cookie banner bypass this
  redirect. Unknown routes return a real 404 with a link to the directory.
- `public/r/` still contains official `shadcn build` output. Its `/r/{name}.json`
  URLs and every existing demo URL are unchanged. Icons now live in `public/`.

The migration adopts Cove's routing and build foundation. The showroom's existing
mock providers do not need Cove's authentication, application database, query
cache, environment manager, or logging services. Storage companion integration
harnesses remain separate from the showroom.

## Updating from Cove

Use the revision in [`.cove.jsonc`](../.cove.jsonc) as the start of the next
upstream comparison. It records the last revision reviewed and reconciled with
this repository, including intentionally excluded changes.

1. Compare that revision with a fixed Cove commit and review its dependency,
   configuration and source changes. Keep the work in one registry-owned
   OpenSpec change.
2. Adopt compatible foundation updates here. For Vite+ major upgrades, run the
   target version's migrator before manually changing toolchain dependencies.
   Preserve lint rules, aliases, generated-file exclusions and the Node test
   runner. Update the pnpm pin in both `package.json` and `Dockerfile`.
3. Keep mock authentication and data providers, showroom routes, themes,
   translations, framework shims, Portless and Nitro deployment. Exclude Cove's
   live auth, application database, TanStack Query integration, Varlock, logging,
   React Compiler, devtools and test-runner conversion. Better Auth and Drizzle
   remain dependencies for published server companions, independently of Cove.
4. Update affected registry dependency declarations and regenerate `public/r/`
   through `pnpm registry:sync`. Validate a clean consumer installation as well
   as the showroom, production server, Portless and relevant storage suites.
5. After verification, advance `.cove.jsonc` to the reviewed commit and record
   the checks and remaining limitations in the owning change.

Vite+ 1.0 pins its Vite core alias through the pnpm catalog. Its own Vitest 5
dependency does not replace the repository's Node tests. The version-scoped
`better-auth@1.7.2>vitest` exclusion removes an optional peer used only by Better
Auth's test utilities, which this repository does not import. Revisit that
exclusion when upgrading Better Auth or introducing those test utilities.

TypeScript 7 supplies the native `tsc` check. The Drive integration test uses
Node's `stripTypeScriptTypes` to serve its browser modules because TypeScript 7
no longer supplies the JavaScript compiler API. Tailwind's updated default font
does not replace the explicit font families in `src/styles/globals.css`.

## Development and production

Use Node `^24.11.0 || >=26.0.0` and pnpm 12.8.1, as pinned in `package.json`.
CI and Docker use Node 24; development types target Node 24 as well.

```sh
pnpm install --frozen-lockfile
pnpm dev                        # https://forge-registry.localhost
PORTLESS=0 pnpm dev              # direct Vite, port 3000 or the next free port
PORTLESS=0 pnpm dev --port 3010   # direct Vite on a chosen port
pnpm build                      # .output/public and .output/server
PORT=3100 pnpm start             # standalone Nitro Node server
TEST_BASE_URL=http://127.0.0.1:3100 pnpm test:browser
```

[Portless](https://github.com/vercel-labs/portless) is pinned as a development
dependency. It starts a shared local proxy, assigns Vite a free port, and forwards
WebSocket connections for hot reload. `portless run` infers `forge-registry` from
the package name and prefixes it with the branch name in linked Git worktrees.
Use the URL printed by `pnpm dev` if your proxy uses custom settings.

With default settings, the first interactive run may request administrator access
to trust a local certificate and bind HTTPS port 443. Start it from a terminal
for that setup. To run without certificate setup or privileged ports:

```sh
PORTLESS_HTTPS=0 PORTLESS_PORT=1355 PORTLESS_SYNC_HOSTS=0 pnpm dev
# http://forge-registry.localhost:1355 in browsers that resolve .localhost
```

For browser tests, start the showroom with `PORTLESS=0 pnpm dev` and set
`TEST_BASE_URL` in another terminal:

```sh
TEST_BASE_URL=http://127.0.0.1:3000 pnpm test:browser
```

Use `PORTLESS=0 pnpm dev` for direct HTTP access, including local shadcn installs.
Run `pnpm exec portless proxy stop` when you want to stop the shared proxy.

Deploy the complete `.output/` directory and run `node .output/server/index.mjs`.
The hosting environment can set `PORT` and `HOST`. The previous `.next/` artifact
and `next start` command no longer apply. Nitro's version is pinned to the Cove
foundation; review deployment behavior when upgrading it.

The [VPS deployment guide](./deployment.md) covers the standalone Docker image
and Dokploy configuration. It follows the template's deployment conventions
without adding an application dependency on the template or requiring live auth.

Run `pnpm format && pnpm lint:fix`, inspect their changes, then
`pnpm registry:sync`, `pnpm registry:check`, `pnpm test`, `pnpm typecheck`,
`pnpm check`, and `pnpm build`. Run browser regressions against the build when
changing routes, adapters, providers, or the shell. Tests include locale redirects,
SSR, registry delivery, navigation/state retention, and theme behavior.

Published source changes still require reviewed shadcn updates in consuming sites.
Changing this showroom's framework does not change those sites' framework or
automatically update their installed components.

## Showroom SEO

Each page route defines its own title and description through TanStack Router's
`head` callback. Splat routes select descriptions using their route parameters;
legal pages use loader data. `src/showroom/seo.ts` formats canonical URLs and
Open Graph and Twitter metadata for `https://registry.the-corner.io`. The root
route owns document assets and fallback metadata for missing pages.

Descriptions use English, matching the showroom navigation, and identify the
content as component demos. Locale prefixes select
demo translations; sample company details and legal text are not showroom facts.

Canonical URLs omit search parameters and trailing slashes. The `/login` alias
points to the matching `/auth` overview. Sample record details, editing flows,
and missing pages use `noindex, follow` and omit canonical links.

This configuration stays under `src/` and is never registered or imported by
portable components. Consuming projects own their page descriptions, domains,
indexing decisions, and social metadata.

## Shared preview frame

Every demo uses `ShowroomPreview`. Supply `controls` and `navigation` as React
content; the frame places them in an always-expanded right sidebar on desktop
and above the preview below 64rem. Demos without settings keep the full width. Demo state and callbacks
stay beside their examples. The shared header has a single sun/moon icon button
that toggles Light/Dark mode. It also provides the first keyboard stop,
**Skip to preview**. Activating it focuses the preview and
preserves the current URL/hash, including the intranet demo's navigation.

Use `ShowroomIntro` for a demo's own title and short instructions. Pages that
already provide a heading retain it without an extra showroom heading. Supply
`notice` for demo limitations below the controls; in-memory examples share
`previewDataNotice`. Auth and newsletter explain their simulated submissions.
Use **Simulate action failures** for repeatable mutation failures and retain
specific labels for one-time upload, loading, or sign-out failures.

Showroom introductions and controls use English sentence case. Related preview
links retain the selected locale. Examples share Acme workspace branding and
consistent people/project names where they represent the same records; specialized
booking, restaurant, and public-page content retains its own meaning.

Localized demos also show a language switch beside the theme control, using the
configured French, English, German and Italian locales. Switching keeps the
current page, query and hash, preserves in-memory demo state through client
navigation, and saves the choice in `FORGE_LOCALE`. The directory and unlocalized
examples omit the switch. The shared `LanguageSwitcher` accepts a `linkComponent`
adapter; the showroom supplies `ShowroomLink` and explicit locale destinations.

The showroom defaults to Light and saves the selected Light/Dark mode under
`forge-showroom-theme`. It applies that choice before paint, across routes and tabs,
and to dialogs portaled to the document body. There is no System or Font control.
The removed font provider/presets were private showroom code; the default CSS font
stacks and portable components' typography remain intact.

Use the standard frame for directories and plugin pages, `width="narrow"` for
small examples, and `width="full"` for complete application layouts that supply
their own main landmark. The frame owns gutters, maximum width, and viewport
height. Existing registry page components accept `className="showroom-page"` to
let the host frame control their outer spacing; their installed defaults remain
unchanged. Full-height layouts can use `showroom-fill`; intranet content uses
`showroom-inset` and its custom sticky toolbar uses `showroom-sticky`.

The shared stylesheet defines the header height once. The desktop settings sidebar
stays below that header, occupies its own grid column, and scrolls independently
when needed. On smaller screens, settings remain expanded in normal page flow.
Preview height and intranet offsets depend only on the header; no JavaScript
measurement is needed. Do not repeat viewport math, header offsets, or per-demo
theme effects in route files. Keep content free to grow and scroll when it needs
more room than the available viewport.

## Next refactors identified

1. **Ship required layout utilities.** Navbar, footer, cookie banner, and many
   `page-*` items reference `container-premium` or `section-padding`, currently
   defined only in the showroom stylesheet. A small registry stylesheet dependency
   would make consumer sizing reliable without copying this application's CSS.
2. **Replace the custom lightbox modal with Base UI Dialog.** Its manual portal
   and Escape listener do not provide focus trapping or focus restoration, and
   its body scroll cleanup can interfere with another overlay. Use the installed
   primitive and semantic `dark` / `dark-foreground` tokens.
3. **Extract only the repeated plugin UI primitives.** Customers, projects,
   blogs, and Drive duplicate button/input/card/confirmation presentation; projects
   also imports customer UI internals. A neutral registry UI item could keep those
   consistent. Keep each plugin's mutation, retry, and permission logic separate:
   blogs and Drive have different persistence guarantees.
4. **Expand preview coverage.** Ten homepage demonstrations cover the feature
   plugins and a few layouts, while the registry ships fifty items. Add grouped
   examples for existing page sections and primitive controls so shared CSS changes
   can be checked in light/dark, narrow layouts, and keyboard flows.
