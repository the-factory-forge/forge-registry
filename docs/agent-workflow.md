# Registry maintenance workflows

Read the applicable sections from [AGENTS.md](../AGENTS.md) before changing files.
Paths in prose and commands are relative to the repository root. Resolve external
checkouts from the workspace or Git remotes; use canonical repositories when needed.

## Git worktree workflow

Use an isolated Git worktree for every task that changes files, including
documentation. This applies to delegated agents too. Reuse a worktree already
dedicated to the task.

1. Record the original checkout path, its current branch and commit, and existing
   staged, unstaged and untracked changes. Create the worktree from that branch's
   current commit. Use `codex/<task>` for a temporary branch; do not assume the
   destination branch is `main`.
2. Make changes and run the required checks in the worktree. If the task depends
   on uncommitted work in the original checkout, copy only the needed files and
   record that baseline so those edits are not mistaken for your own.
3. When the task is complete, apply only your task's diff back to the original
   checkout on the recorded branch, including added and deleted files, assets and
   generated output. Leave the transferred changes uncommitted. Preserve existing
   edits and staged contents. Recheck the branch and overlapping edits before
   transferring; resolve conflicts without overwriting someone else's work.
4. Review the transferred diff and run the relevant checks in the original
   checkout. Only then remove the task's worktree and any temporary branch you
   created. Preserve any needed ignored files before cleanup. If transfer or
   verification is blocked, keep the worktree and report what remains.
5. Do not push unless the user explicitly requests it.

## Releases and source maintenance

For release preparation, follow the [shared release procedure](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/workflows/release-source.md)
and use [release](https://github.com/the-factory-forge/forge-skills/blob/main/skills/release/SKILL.md) from `forge-skills`.
Read [.agents/configs/.release/config.json](../.agents/configs/.release/config.json) for version files, tagging,
note storage and publication defaults. `package.json` owns the version; keep
reviewed notes in `docs/releases/v<version>.md`. Preparation creates a local
commit and annotated tag; `--push` also completes configured GitHub publication,
while `--local` stays local. Publication never updates customers.

When a user asks to promote a discussed customer improvement upstream, use
[sync-to-forge-registry](../.agents/skills/sync-to-forge-registry/SKILL.md). Promote only that
behavior against current registry source, preserving unrelated customer drift and
newer registry changes. This skill is also usable from consumer checkouts.

For selected registry updates into a customer site, use
[sync-from-forge-registry](../.agents/skills/sync-from-forge-registry/SKILL.md).
Both registry sync directions are maintained here. Package maintenance uses
[update-dependencies](https://github.com/the-factory-forge/forge-skills/blob/main/skills/update-dependencies/SKILL.md) from `forge-skills`.

## Shared Forge specifications

Before implementation, resolve `forge-specs` from the workspace or Git remotes.
Read its `AGENTS.md`, `the-forge`, `registry-distribution` and, for UI/CSS/Tailwind
work, `shared-ui` specs under its `openspec/specs/`. Read `host-integration` when consumer integration
is affected. Template application details live in
`forge-template/openspec/specs/site-template/spec.md`. If that checkout is elsewhere,
use its supplied location or the
[canonical forge-specs repository](https://github.com/the-factory-forge/forge-specs).
Report inaccessible context rather than assuming it was loaded.

`openspec/config.yaml` supplies Forge context for OpenSpec artifact generation.
Keep registry-specific specs and changes here, including plugin definitions,
plugin behavior, showroom rules and registry release checks. Only contracts that
constrain both registry and template belong in forge-spec. Installing a plugin in
a host does not by itself make its spec shared. Keep one owning change root.
These specs complement the repository procedures
below; inspect current source and report material conflicts. A sibling reference
does not expand the task to unrelated changes in that repository.

For plugin work, also read the local [Plugins specification](../openspec/specs/plugins/spec.md)
and [local plugin guide](../docs/plugins.md). Update the plugin definition and its
module requirement when adding or materially changing a feature.

Local main specs live under `openspec/specs/`, including `plugins`, `reservations`,
`registry-showroom` and `registry-releases`. The [Blogs storage decision](../concepts/adr/0009-blog-content-and-image-storage.md)
is registry-owned. For Mailing rendering or transport, read
[ADR-0012](../concepts/adr/0012-mailing-rendering-and-transport.md); for plugin locks,
projections or customer identity transactions, read
[ADR-0013](../concepts/adr/0013-plugin-persistence-and-identities.md). Their linked
shared decisions retain host branding and project migration ownership.
Use forge-spec's installed OpenSpec CLI with this repository
as the working directory; generated OpenSpec skills remain central.

## Extracting a component from tc-website

Resolve the actual `tc-website` checkout, then start in its `src/components/` for shared compositions (for example,
`public-page-header.tsx`, `public-section-heading.tsx`, and `pill-badge.tsx`),
`src/components/ui/` for primitives, and `src/routes/` for usage. Inspect
`src/hooks/`, `src/styles.css`, `src/css/`, and `public/` for supporting code and
assets. Larger application modules live in `src/features/` and can require
substantial host integration; do not treat them as standalone UI automatically.
`registry/forge-bexio-customers/README.md` is an existing reference
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
   `src/styles.css` in that checkout; do not copy its entire theme or app infrastructure.
4. Convert site imports to `@/components/...`, `@/components/pages/...`, `@/components/layouts/...`, or `@/components/utils/...` and framework APIs to the shim
   contract. Reuse the local Base UI primitives; preserve supported composition
   APIs such as `render` when adapting source components.
5. Register the complete dependency set, provide representative demo usage, and
   validate the result as described below. The reusable result must work without
   access to `tc-website`'s files, services, or providers.

## TC intranet plugin listing

Every newly created plugin must also be listed on `tc-website`'s public
`/forge/intranet` page as part of the same work. Update the `intranetModules` list
in `src/routes/_public/{-$lang}/forge/intranet/index.tsx` in that repository and
the translations in `src/lib/i18n/content.ts` for all supported locales. Include
an accurate description, availability status, and the matching icon from
`registry/components/utils/plugin-icons.ts`. List storage/server companions with
their parent plugin rather than as separate modules.

Locate the actual `tc-website` checkout instead of assuming a sibling path. If it
is unavailable, report the pending listing update explicitly in the handoff.

## Distribution and validation

`pnpm registry:sync` runs the pinned official CLI:
`shadcn build registry/registry.json --output public/r`. Only declared files
and dependencies ship.

`public/r/registry.json` and `public/r/{name}.json` are official shadcn catalog
and item output. The manifest declares `@components/`, `@components/pages/`, `@components/layouts/`, and
`@components/utils/` targets and `@forge/item-name` registry dependencies.
Source imports match those locations; shadcn resolves the consumer's configured
aliases. Showroom i18n and providers live in `src/lib/`
and are not registry items. Shared components must not import from `src/lib/`
or `src/showroom/`. Consumers own locale routing, dictionaries, and themes.

After the first source release, use its verified full commit SHA for the whole
`@forge` namespace, following [registry installation](../README.md#installing-from-the-registry). Before that, the current
development namespace in `components.json` is
`https://raw.githubusercontent.com/the-factory-forge/forge-registry/main/public/r/{name}.json`.
Install with `shadcn add @forge/item-name`. To test locally, run
`pnpm registry:sync` and `PORTLESS=0 pnpm dev`, then temporarily set the consumer's `@forge`
URL to `http://localhost:3000/r/{name}.json`. This also routes dependencies to the
local server; no build environment override is required. Restore the published
namespace URL before committing consumer configuration.

`pnpm dev` normally uses Portless at `https://forge-registry.localhost`, with
branch subdomains for linked worktrees. See `docs/showroom.md` for proxy setup
and browser test URLs. `PORTLESS=0` bypasses the proxy for direct-port workflows.

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
