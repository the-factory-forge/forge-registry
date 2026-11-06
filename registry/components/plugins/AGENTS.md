# Working on plugins

Each immediate child directory has an `AGENTS.md` explaining its code flow and
change-sensitive boundaries. Read it before editing that plugin, its server
companion, a connector calling it, or its showroom adapter.

## Documentation ownership

- Local `AGENTS.md` files explain implementation seams and point to relevant
  checks. Keep them current when code moves or its flow changes.
- [The plugin guide](../../../docs/plugins.md) indexes installation and host
  integration guides. Those guides own callback examples, adoption and migrations.
- [The Plugins spec](../../../openspec/specs/plugins/spec.md) owns observable
  behavior and acceptance scenarios; [Reservations](../../../openspec/specs/reservations/spec.md)
  owns its detailed scheduling contract. Read the affected requirements and shared
  plugin requirements before changing behavior. Keep scenarios in their owning spec.
- [The manifest](../../registry.json) owns shipped files and dependencies. These
  `AGENTS.md` files are repository contributor guidance, not installable items.

## Following a change

Trace UI through its props/client contract to the host callback and optional server
companion. Follow imports across plugin boundaries and into
[`connectors/`](../connectors/) before changing a contract. Inspect the manifest
entries for the UI and any server companions; keep browser imports free of server
dependencies. The integration guide identifies host-owned authorization and setup.

For persistence, locks or migrations, read [persistence](../../../docs/persistence.md)
and [ADR-0013](../../../concepts/adr/0013-plugin-persistence-and-identities.md).
For mutation lifetime, confirmation or retry changes, read
[optimistic actions](../../../docs/optimistic-actions.md) and
[table selection](../../../docs/table-selection.md); their shared helpers own the
common behavior. For presentation, use the root contribution/design guidance and
the [shared presentation pointers](../../../docs/plugins.md#shared-presentation).

## Verification

Use each plugin's local check pointers to select relevant tests, then follow the
root validation workflow. Test service changes at their authorization, validation
and failure boundaries; test UI lifetime changes with delayed responses and client
or resource replacement. Inspect the matching `src/showroom/` adapter and fixtures.
Mock previews establish UI behavior; storage harnesses and host adoption require
their own evidence. Documentation-only changes need formatting, link and factual
review, and a clean whitespace diff.
