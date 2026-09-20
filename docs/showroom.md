# Showroom architecture

The showroom uses TanStack Start and Router, React, Vite+, Tailwind's Vite plugin,
and Nitro. Its framework foundation was adapted directly from
[Cove at b9f2b22](https://github.com/mugnavo/cove/tree/b9f2b22ac380ba11c080fa35ca3387ac11618e51)
(Unlicense). The application keeps its own dependencies and configuration; Cove
is a reference, not a package dependency or a directory to synchronize wholesale.

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
  example directory. Add new demos there as well as creating their route.
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

## Development and production

Use Node 24 or newer and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev                        # port 3000, or the next free port
pnpm dev --port 3010             # select a port explicitly
pnpm build                      # .output/public and .output/server
PORT=3100 pnpm start             # standalone Nitro Node server
TEST_BASE_URL=http://127.0.0.1:3100 pnpm test:browser
```

Deploy the complete `.output/` directory and run `node .output/server/index.mjs`.
The hosting environment can set `PORT` and `HOST`. The previous `.next/` artifact
and `next start` command no longer apply. Nitro's version is pinned to the Cove
foundation; review deployment behavior when upgrading it.

Run `pnpm format && pnpm lint:fix`, inspect their changes, then
`pnpm registry:sync`, `pnpm registry:check`, `pnpm test`, `pnpm typecheck`,
`pnpm check`, and `pnpm build`. Run browser regressions against the build when
changing routes, adapters, providers, or the shell. Tests include locale redirects,
SSR, registry delivery, navigation/state retention, and theme behavior.

Published source changes still require reviewed shadcn updates in consuming sites.
Changing this showroom's framework does not change those sites' framework or
automatically update their installed components.

## Shared preview frame

Every demo uses `ShowroomPreview`. Supply `controls` and `navigation` as React
content; the frame places them in an always-expanded right sidebar on desktop
and above the preview below 64rem. Demos without settings keep the full width. Demo state and callbacks
stay beside their examples. The shared header owns Light/Dark selection and the
first keyboard stop, **Skip to preview**. Activating it focuses the preview and
preserves the current URL/hash, including the intranet demo's navigation.

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
