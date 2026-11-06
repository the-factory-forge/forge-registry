# Agents

Agents provides private operation-based staff chat and optional external MCP tools.
Read the [integration guide](../../../../docs/agents.md),
[Agents requirements](../../../../openspec/specs/plugins/spec.md#requirement-agents-plugin)
and, for MCP changes, the
[external execution requirement](../../../../openspec/specs/plugins/spec.md#requirement-external-assistant-tools-reuse-durable-agents-execution)
and the guide's linked shared access contract.

## Logic and ownership

- `index.tsx` owns operation selection, conversation drafts/history, file staging
  and approval UI through the client contract in `types.ts`. Hosts own URL state.
- `server/service.server.ts` resolves fresh actors and operation access, owns
  conversations, server history and attachment lifecycle, and coordinates runtime
  turns. `store.server.ts` and `schema.ts` persist records and serialized changes.
- `server/execution.server.ts` is the common execution path for chat and MCP.
  Reads validate input and call existing services. Writes first store their input,
  review and snapshot; execution revalidates them and runs only stored arguments.
  A started write with an uncertain result becomes unresolved and requires trusted
  host reconciliation. Retrying an approval must never replay the write.
- `server/connection.server.ts` protects administrator-managed provider secrets;
  `models.server.ts` supplies model discovery/runtime adapters. External execution
  can use the service without configuring a model runtime.
- `server/mcp.server.ts` binds proposals to the authenticated connection and
  narrows installed operations by scopes. It excludes attachment-dependent tools.
  Matching review arguments establish payload integrity, not proof of a separate
  human approval; OAuth and client confirmation settings remain host/client concerns.

## Change boundaries

Business operations live in separately installed `connectors/agents-*/server/`
modules and call the domain services. Preserve their authorization, reviewed
retention tokens and validation instead of duplicating business mutations here.

Private files use stable references and integrity checks; signed download URLs and
bytes do not become conversation metadata. Result links come from trusted host
routing. Cancellation cannot promise rollback of an already-started write. Cleanup
and unresolved records must survive failures and process restarts.

## Checks

Use [service tests](../../../../tests/agents.test.mjs),
[connector tests](../../../../tests/agents-connectors.test.mjs),
[model tests](../../../../tests/agents-models.test.mjs) and
[MCP tests](../../../../tests/agents-mcp.test.mjs) for the affected seam.
Durability changes need `tests/agents/` integration suites; UI changes use
[browser tests](../../../../tests/agents.browser.mjs) and `src/showroom/agents-mock.ts`.
