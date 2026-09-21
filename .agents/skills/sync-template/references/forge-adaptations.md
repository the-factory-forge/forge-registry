# Forge adaptations to preserve during upstream sync

Use this map for affected files, then verify their current contents and local history. Paths may move. Current user instructions and `AGENTS.md` override this reference; historical documents explain intent but are not blanket overwrite policies.

## Path mapping

| TanStarter location | Forge location / treatment |
| --- | --- |
| `src/lib/auth/` | `src/intranet/auth/`; adapt upstream auth fixes to optional auth and Forge's guards. |
| `src/lib/db/` | `src/intranet/db/`; update compatible APIs without replacing the application's schema or migration history. |
| Auth components, social/sign-out buttons, starter intro | `src/intranet/components/`; inspect actual moved files before resolving rename/delete conflicts. |
| `_auth`, `_guest`, and `api/auth` routes | `src/intranet/routes/`; retain localized login, password change, and `/{locale}/intranet` routes. Do not restore a parallel `/app` flow. |
| Router/start/Vite configuration | Shared framework files plus optional intranet route registration; combine upstream infrastructure fixes with that separation. |
| Shared shadcn UI | `src/components/ui/`; merge relevant changes after checking Forge patches and registry consumers. |

## Runtime and auth

- The public site works without database/auth credentials and after removing `src/intranet`. Preserve its optional route, site-shell, and dictionary integration. Do not add direct public imports from the intranet or move its code back into shared folders.
- Retain optional `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.schema`, null auth when disabled, server-side authorization, localized redirects, disabled public signup, built-in `admin`/`user` roles, employee management, email verification, and first-login password changes. New upstream capability is not a reason to enable it by default.
- Preserve the current QueryClient/SSR integration, shared query options, and server-function boundaries. Adapt upstream API changes in both runtime code and tests; use current `.agents/data-flow.md` and `.agents/auth.md` rather than old examples.
- `.env.schema` is the environment contract. Preserve application imports from `varlock/env`, code generation, sensitive-value protections, and grouped example configuration. Never inspect local env files to resolve a merge.

## Public site and registry

- Retain configured locales, dictionaries, public routes, site data, SEO helpers, sitemap/robots/llms/data endpoints, canonical-host behavior, consent-controlled analytics, and conversion configuration. Reconcile shared implementation fixes without resetting content to TanStarter examples.
- Preserve the current semantic CSS theme, typography, public stylesheet link, font assets, actual configured logo/favicon, and light/dark behavior. Font and palette pickers were removed; do not restore their providers, presets, or unused font packages. Upstream defaults must not silently replace Forge's public identity. Follow current theme guidance, not the older roadmap's CSS ownership recipe.
- Keep the exact footer credit `Forged by The Corner Factory SA`.
- Keep the `@forge` registry configuration and selected source URL in `components.json`. A TanStarter sync does not implicitly request a registry upgrade. Retain registry adapters, host-owned shell navigation, and the consent callback in the site layout. Registry updates, when needed, follow the separate `vpr ui add @forge/<item>` workflow and current intranet target relocation instructions.
- Preserve both `#/*` and `@/*` aliases while callers use them. Do not treat similar adapter filenames as proof they are interchangeable.

## Toolchain, database, and deployment

- Keep Forge scripts, optional environment declarations, workspace catalog/override consistency, and the current `minimumReleaseAge` policy. Derive versions from the reconciled manifests, not this reference or a historical example.
- Preserve the `prepare` responsibilities (`vp config && vp run env:codegen`) unless the target requires an equivalent reviewed replacement. Docker installs use `--ignore-scripts`; its build retains `pnpm_config_ignore_scripts=true pnpm build` so pnpm's internal dependency check inherits that setting. Do not drop prepare or its codegen just to make a container build pass.
- Retain Nitro hosting, compression, public asset headers, Docker entrypoint behavior, deployment variables, and per-site database isolation. Inspect startup scripts before executing them because they may apply migrations.
- Preserve committed migration history and Forge-specific auth fields. Generate any necessary incremental migration against the reconciled schema and test it on a disposable local database. Do not rewrite applied migrations, copy upstream seed data over users, or reset a database as part of syncing code.
- Merge useful upstream guidance into current docs and skills. Preserve Forge-specific instructions and sync records. Avoid importing conflicting historical recipes as new mandatory rules.
