# Verification

Verified in the isolated `codex/supports-github` worktree, against baseline
`c79cfe2ac546acc2c63cf17a96039f4e403d61f3`.

- Formatter, lint (including autofix review), `vp check`, standalone TypeScript,
  registry JSON parsing, official shadcn generation and production build pass.
- Connector PostgreSQL suite: 15 tests pass. Supports PostgreSQL/MinIO regression
  suite: 8 tests pass. Composed migrations/auth persistence: 7 tests pass.
- Connector, Supports and existing Connector showroom browser suites: 10 tests
  pass across the relevant runs. Desktop/mobile light/dark captures reviewed.
- Full unit suite: 177/179 pass. The two failures are the existing Blogs and Drive
  source-file inventory assertions, which incorrectly expect their `AGENTS.md`
  files in shipped UI items. Both reproduce in the untouched original checkout.
  The portable registry dependency and generated-output checks pass.
- A clean disposable consumer installs both items and all dependencies through
  the official shadcn CLI. Its installed source and server composition example
  compile with strict TypeScript and host Node/React types. Reinstallation of the
  final generated artifact also passes.

The environment's pnpm 12 launcher cannot execute. Checks use the installed pnpm
10.25 launcher with `npm_config_manage_package_manager_versions=false`, preserving
repository package-manager pins and all existing dependency versions. The clean
consumer resolves its own declared packages through shadcn/npm.

No consumer checkout was modified, no production migrations ran and no live GitHub
writes were made. Host adoption still requires App credentials, migrations,
webhook routes, workers, monitoring and private-repository acceptance testing.
