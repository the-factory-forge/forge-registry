## Context

Drive already has per-space database locks, preview tokens, immutable object keys,
a canDelete host guard and durable leaf-first permanent cleanup. The portable
DriveClient is implemented by host transports; Menus reads only ready files.
No website currently runs Drive, so trash belongs in the initial schema.

## Goals / Non-Goals

Recover complete file/folder groups without losing IDs or overwriting active files.
Keep custom adapters without trash usable. Search redesign, previews, file moves,
version history and public sharing are outside this change.

## Decisions

An optional trash configuration enables three optional client methods. The initial
SQL and Drizzle schema include trash. Thirty days is the default, bounded to 1–365.
Restore is a new optional capability, denied by default; changing the name also
needs rename.

Trash roots detach from their active parent. Descendants retain parent IDs, while
all members carry group and expiry metadata. Historical original parents have no
foreign key. Partial unique indexes apply only to active names. Independently
trashed groups remain independent when an ancestor is later removed.

Normal file access excludes trashed/purging states. Restore runs under the same
lock, validates original or supplied same-space folder, name, depth and expiry,
and never overwrites. Conflicts open a short name/destination dialog. Trash exposes
root rows, expiry and pending cleanup. A permitted Undo toast action reuses restore,
keeps requests retryable and routes conflicts to Trash. It refreshes the current
listing after recovery, including while viewing Trash. Confirmed permanent deletion keeps its
existing API. Expired groups join bounded maintenance and durable object retries.

The existing host canDelete guard runs before trash and purge. Menus rejects
references and reads unless files are ready. Objects remain private and unversioned.
This preserves the portable UI, host persistence and source distribution decisions
in [ADR-0001](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/repository-ownership-and-source-distribution.md),
[ADR-0002](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/portable-ui-and-host-adapters.md),
[ADR-0005](https://github.com/the-factory-forge/forge-spec/blob/main/concepts/adr/optional-intranet-and-server-authority.md) and
[ADR-0007](https://github.com/the-factory-forge/forge-template/blob/main/concepts/adr/host-configuration-persistence-and-deployment.md);
no cross-repository runtime dependency is introduced.

## Risks / Trade-offs

Database initialization and authenticated transport wiring remain host work.
Already issued signed URLs can survive until expiry. Subtree metadata work scales with group size;
object cleanup remains bounded. Hosts must keep trash enabled until retained groups
are drained and schedule maintenance.

## Initial Setup

Initialize the database with migration.sql (or generate a reviewed initial
Drizzle migration), wire the three optional operations and restore capability,
then enable trash. Validate local consumer installation before publishing source.
