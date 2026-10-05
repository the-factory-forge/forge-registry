# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Forge developers building and maintaining customer websites and intranets are
the primary users. They need to find suitable reusable UI, inspect its behavior,
and integrate editable source into a customer's application. Prioritize reuse
and integration when making product decisions.

## Product purpose

Forge Registry supplies reusable React components, page sections, layouts,
utilities, and optional application plugins through shadcn's registry model.
Its web showroom lets developers explore and test examples before adopting them.

Success means developers can reuse an item across customer projects, understand
its integration requirements, and adapt the source without depending on showroom
code or another customer's application.

## Positioning

Forge Registry is the shared source catalog within The Forge, The Corner Factory
SA's offering for tailored websites and internal workspaces. Consumers install
editable source through the `@forge` namespace and retain control of their copies.
The registry is not a runtime npm library.

The registry owns portable UI and optional server companions. `forge-template`
owns the starting application. Customer sites own their content, branding, data,
credentials, and integrations. Shared contracts live in `forge-spec`; see the
[Forge specification](../forge-spec/openspec/specs/the-forge/spec.md).

## Operating context

Developers browse the showroom directory, search or filter its examples, and open
demos to inspect interactions. Localized demos support French, English, German,
and Italian. The showroom provides shared preview controls and saved Light/Dark
selection. Demo records use mock data; reloading resets in-memory changes.

Developers install named items with shadcn, wire host adapters, and validate them
in the consuming application. Updates require another reviewed source install
and deployment by each consumer. Publishing registry changes does not update
running customer sites automatically.

See [README.md](./README.md) for installation and
[docs/showroom.md](./docs/showroom.md) for preview and development workflows.

## Capabilities and constraints

- The [source manifest](./registry/registry.json) owns the shipped inventory,
  files, and dependencies. Generated endpoints under `public/r/` distribute them.
- Shared UI receives content, translated labels, and integration callbacks through
  props. Consumers own routing, dictionaries, themes, and framework adapters.
- The showroom is a separate TanStack Start application. Registry UI must work
  without its private providers or code, and without sibling repository imports.
- Optional server companions require explicit host integration for authorization,
  persistence, credentials, and migrations. UI checks do not replace server guards.
- Every new UI item needs a working demo discoverable from the showroom homepage.
  A successful preview alone does not establish that an item works in a consumer.

[AGENTS.md](./AGENTS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) own the detailed
engineering requirements. Item guides under `docs/` define integration contracts.

## Brand commitments

The public offering is The Forge, shortened to Forge in prose. The company name
is The Corner Factory SA. Customer branding belongs to the consuming site.

Agency credits use the exact, non-translatable text
`Forged by The Corner Factory SA`, with the official Corner `c` logo to its left.
The attribution asset and implementation rules are recorded in
[AGENTS.md](./AGENTS.md).

## Evidence on hand

The [homepage directory](./src/routes/index.tsx), demo routes under `src/routes/`,
and item guides under `docs/` provide examples of implemented behavior. The
[manifest](./registry/registry.json) identifies what actually ships.

Sample company details, legal text, and mock records demonstrate component
behavior. They are not customer endorsements, verified business facts, or
evidence of production results. Commercial availability and delivery commitments
require confirmation for the specific engagement.

## Product principles

- Make reusable behavior work in the consumer, with explicit dependencies and
  integration requirements.
- Keep customer decisions and data under the consuming application's control.
- Make shipped UI discoverable and testable through representative demos.
- Preserve existing item names and public contracts unless a breaking change is
  intentional and its migration is addressed.

## Accessibility & inclusion

Preserve semantic HTML, keyboard operation, visible focus, accessible control
names, and announced dynamic feedback. Support narrow screens, translated labels,
both themes, and reduced-motion preferences. Communicate status with text as well
as color. These are contributor requirements, not a claim of audited compliance.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the implementation rules and
[CONTEXT.md](./CONTEXT.md) for existing interaction requirements.

## Open decisions

No additional priority audience or quantified product success target was set
during initialization.
