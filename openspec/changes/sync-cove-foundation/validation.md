# Cove foundation verification

Verified on 2026-10-03 with Node 24.21.0 and pnpm 12.8.1. The reviewed upstream
comparison is
[`b9f2b22...ebd3e81`](https://github.com/mugnavo/cove/compare/b9f2b22ac380ba11c080fa35ca3387ac11618e51...ebd3e81a9fa91ba2f4c040012e3f3925352c16bf).
Existing Portless work was preserved.

## Adopted versions

| Package                      | Before           | After    |
| ---------------------------- | ---------------- | -------- |
| Vite+ and Vite core alias    | 0.3.3            | 1.0.0    |
| pnpm                         | 11.20.0          | 12.8.1   |
| TypeScript                   | 5.9.3            | 7.0.2    |
| React / React DOM            | 19.2.4           | 19.3.0   |
| React / React DOM types      | 19.2.17 / 19.2.3 | 19.3.0   |
| Node types                   | 20.19.43         | 24.19.1  |
| TanStack Router              | 1.170.38         | 1.170.41 |
| TanStack Start               | 1.168.56         | 1.168.60 |
| Base UI                      | 1.7.0            | 1.8.0    |
| Tailwind and its Vite plugin | 4.3.0            | 4.3.3    |
| Lucide                       | 1.23.0           | 1.49.0   |
| shadcn CLI                   | 4.19.1           | 4.21.1   |
| Playwright library           | 1.62.1           | 1.63.0   |

Nitro, the React Vite plugin, Better Auth, Drizzle and Portless retain their
existing versions. The Node engine is `^24.11.0 || >=26.0.0`. CI and Docker
remain on Node 24. The showroom guide records all application exclusions.

The [Vite+ migrator](https://viteplus.dev/guide/migrate) ran before manual
dependency replacement with agent, editor and hook setup disabled. It preserved
`vite.config.ts` and introduced the exact Vite+ catalog pins. The broad Vitest 4
override was replaced with a version-scoped exclusion of Better Auth's unused
optional test peer. `pnpm peers check` reports no conflicts.

The [TypeScript 7 migration](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
requires replacing its removed compiler API. The Drive test now uses Node's
native type stripping for its two browser modules. No TypeScript configuration
or component API changes were needed. Existing React, Base UI, Tailwind, Lucide
and shadcn usage remained compatible; no new library feature justified a
component rewrite. The explicit showroom fonts remain unchanged.

## Checks

| Check                                                | Result                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frozen install and peer dependency check             | Passed                                                                                                                                           |
| `pnpm format` and `pnpm lint:fix`                    | Passed; automatic edits reviewed                                                                                                                 |
| `pnpm registry:sync` and `pnpm registry:check`       | Passed; only reservations pins changed in generated JSON                                                                                         |
| `pnpm test`                                          | 52 passed                                                                                                                                        |
| `pnpm typecheck` and `pnpm check`                    | Passed                                                                                                                                           |
| `pnpm build`                                         | Passed                                                                                                                                           |
| Production browser suite                             | 66 passed, matching the 66-test baseline                                                                                                         |
| Deployment smoke against standalone Nitro and Docker | Passed for both; SSR, assets, all 59 item endpoints and auth API 404                                                                             |
| Docker build                                         | Passed with Node 24 Alpine and pnpm 12.8.1                                                                                                       |
| Portless startup                                     | Homepage, 59-item catalog and Vite WebSocket connected through the isolated HTTP proxy                                                           |
| `PORTLESS=0 pnpm dev`                                | Homepage and registry served directly on port 3000                                                                                               |
| Drive storage suite                                  | 11 passed against disposable PostgreSQL and MinIO; restart persistence check also passed                                                         |
| Clean reservations consumer                          | Official shadcn 4.21.1 installed 15 files; exact Base UI/Lucide pins, frozen install, peers, TypeScript 7 and standalone Vite 8.3.1 build passed |
| OpenSpec strict validation                           | Passed                                                                                                                                           |

The first upgraded browser run exposed a timing race in the project deletion
test. The dialog was visible before focus reached Cancel. Eight isolated
checks confirmed the expected focus settled, with two observing that transient
ordering. The test now waits for focus and retains its original assertions.
The full suite then passed. No lint protection was disabled.

Consumer validation used a temporary directory and the local rebuilt endpoints;
no customer repository or published namespace configuration was changed.
Portless validation used temporary state, HTTP port 1355 and no host-file or
certificate setup. Default HTTPS certificate installation was not exercised.

## Remaining findings

The nine existing accessibility lint warnings remain. Production builds retain
dependency module-directive warnings. Node reports its experimental native
type-stripping API during the Drive test.

The resolved TanStack server core is `1.169.39`, paired with Start `1.168.60`,
the fixed versions in
[GHSA-qx66-fv34-fjm8](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8).
No application-defined server functions were found; practical exposure of the
old showroom was not established.

`pnpm audit` still exits nonzero with 16 high and 6 moderate findings. Auditing
the saved pre-sync lockfile returned 19 high and 7 moderate findings. No new
advisory IDs appeared. The remaining findings involve brace-expansion, braces,
js-yaml, browserslist, baseline-browser-mapping, fast-uri and ip-address.
They are outside the approved exact-version sync. The audit service did not
return the TanStack advisory for either lockfile, so its fix was verified
directly against the published advisory and resolved dependency graph.

No deployment, publishing, commit or consumer-site update was performed.
