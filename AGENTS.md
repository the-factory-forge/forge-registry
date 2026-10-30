# Project context for AI contributors

This repository owns reusable registry source, plugin behavior and the showroom.
Consumers receive source they can adapt; this is not a runtime npm library.
Read [README.md](README.md) for setup and distribution and [GLOSSARY.md](GLOSSARY.md)
for domain terms. `registry/registry.json` owns shipped items and dependencies;
`package.json`, `vite.config.ts` and `tsconfig.json` own tooling and aliases.

## Git worktree workflow

Before changing any file, including documentation, follow the
[isolated worktree procedure](docs/agent-workflow.md#git-worktree-workflow).
Reuse a worktree dedicated to the task. Transfer only the task's verified diff
back to the original checkout, leave it uncommitted and preserve existing edits.
Remove the worktree only after verification; keep it if transfer is blocked.
Push only when explicitly requested. These rules also apply to delegated agents.

## Barebones scope and confirmation

Everything added to this library must be **barebones**: the smallest complete
capability that most customer websites using that feature are likely to need.
Apply this rule to components, plugins, helpers, configuration and showroom
examples. Preserve validation, authorization, accessibility and failure recovery.
Use neutral sample content and existing defaults. Do not add brand presets or
brand selectors; customer identity and styling belong in the consuming website.
Site-specific fields, assignment rules, integrations and workflows belong there
too. Props and feature flags alone do not make an addition broadly useful.

Before implementing an addition, identify its common customer use case. If it
goes beyond barebones scope, or that boundary is unclear, tell the user exactly
what exceeds the baseline, why it is proposed, and the smallest alternative
(including keeping it in the host). **Wait for explicit user confirmation before
implementing that part.** A general request to improve or extend a feature is
not confirmation of the exception. Reuse an explicit scope decision already
made in the task; continue independent, authorized work while awaiting a decision.

## Shared Forge specifications

Resolve actual provider checkouts from the workspace or Git remotes; `forge-specs`
may be named `forge-spec` locally. Follow the
[specification guide](docs/agent-workflow.md#shared-forge-specifications) before
implementation; use canonical links if local sources are unavailable and report
missing context. Registry-only specs and ADRs stay here. Contracts constraining
both registry and template belong to Forge Specs. Keep one owning change root.
Reading another repository does not authorize unrelated changes there.

## Task guides

| Task                                              | Read before editing                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable source or components                     | [CONTRIBUTING.md](CONTRIBUTING.md), the affected item and its imports/consumers; preserve names and public props unless a breaking change is requested                                                                                                                    |
| Plugin behavior                                   | [Plugins spec](openspec/specs/plugins/spec.md), [plugin guide](docs/plugins.md) and the module's guide; update its definition and requirement with material behavior changes                                                                                              |
| UI, theme, layout or accessibility                | [DESIGN.md](DESIGN.md), contribution conventions and shared [UI contracts](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md)                                                                                                   |
| Filters, search, sorting, pagination or calendars | [ADR-0008](https://github.com/the-factory-forge/forge-specs/blob/main/concepts/adr/0008-url-owned-filters-and-view-state.md); portable controls expose values/callbacks, host adapters bind URL state; verify reload and Back/Forward                                     |
| Storage operations or adoption                    | [Scoped storage contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/host-integration/spec.md#requirement-site-and-plugin-scoped-object-storage); verify callers/fixtures and keep deployed-object migration separate from source adoption |
| Showroom previews or homepage                     | [Showroom guide](docs/showroom.md) and [component checklist](CONTRIBUTING.md#component-checklist)                                                                                                                                                                         |
| Shell or sidebar integration                      | [Intranet](docs/intranet.md) and [sidebar](docs/intranet-sidebar.md)                                                                                                                                                                                                      |
| Extracting TC components                          | [Extraction workflow](docs/agent-workflow.md#extracting-a-component-from-tc-website)                                                                                                                                                                                      |
| Adding a plugin                                   | [TC listing requirement](docs/agent-workflow.md#tc-intranet-plugin-listing)                                                                                                                                                                                               |
| Distribution or consumer adoption                 | [Distribution and validation](docs/agent-workflow.md#distribution-and-validation)                                                                                                                                                                                         |
| Releases or maintenance                           | [Provider procedures](docs/agent-workflow.md#releases-and-source-maintenance) and [.agents/.release.json](.agents/.release.json)                                                                                                                                          |

The showroom follows Cove directly; keep its foundation independent of
`forge-template`. Customer branding, data and adapters stay in the host. Shared
UI must ship its own dependencies and use framework shims; a working showroom
alone does not prove consumer portability. Treat [MECHANICS.md](MECHANICS.md) as
historical context to verify, not an instruction to fix every recorded gap.

## Validation

Follow [CONTRIBUTING.md](CONTRIBUTING.md#formatting-and-validation) for implementation
checks and [distribution checks](docs/agent-workflow.md#distribution-and-validation)
when shipped source changes. Documentation changes need formatting, diff and
factual/link review. Report actual checks and remaining consumer work.
