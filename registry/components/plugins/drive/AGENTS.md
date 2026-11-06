# Drive

Drive manages private files in entity-scoped spaces. Read the
[integration guide](../../../../docs/drive.md) and
[Drive requirements](../../../../openspec/specs/plugins/spec.md#requirement-drive-plugin)
before changing a transfer, listing or deletion flow.

## Logic and ownership

- `index.tsx` composes spaces and folder browsing through `DriveClient` in
  `types.ts`. `use-listing.ts` cancels departed reads, retains rows on retryable
  errors and clears them on denied/missing results. Folder-tree pages accumulate;
  table pages replace their rows.
- `use-uploads.ts` owns queued file state and cancellation; `transfer.ts` performs
  the transfer. UI snapshots expose progress and actions, keeping files and abort
  controllers private. `download.ts` builds bounded browser ZIP downloads from
  existing authorized reads.
- `use-deletion.ts` shares preview/token state between single and bulk deletion.
  `recovery.tsx` owns Undo and restore retries, including destination/name conflicts.
- `server/storage.server.ts` validates scope and permission under the shared
  space lock. Uploads reserve, stage bytes, verify and finalize before exposing a
  ready file. Retries reuse the same request ID and payload; completed reservations
  retain tombstones. Renaming changes metadata, not stored bytes or object keys.
- Deletion marks a subtree before removing bytes and metadata from leaves upward.
  Failures retain cleanup state for retry/maintenance. Trash preserves recoverable
  groups; `deleteEntry` always means permanent deletion. Restoration never overwrites.

## Change boundaries

Scope resolution, download authorization and reference guards remain server-side.
Trusted file access is for server callers, including Menus, and is not a public
download endpoint. Entity removal must coordinate with `deleteSpace`'s transaction
or the host's durable deletion protocol, rather than a separate emptiness check.

For object names, private buckets, lifecycle configuration or trash adoption, use
the corresponding sections of the guide. Preserve cleanup records, replay safety
and scoped keys when simplifying code. Projects–Drive and Agents connectors are
additional callers of the same contracts.

## Checks

Start with [Drive tests](../../../../tests/drive.test.mjs) and the relevant
`tests/drive-*.browser.mjs` flow. Transfer/storage changes also need the
[storage harness](../../../../tests/drive-storage/storage.integration.mjs);
Menus image changes need its integration suite. `src/showroom/drive-mock.ts`
and `src/showroom/drive-preview.tsx` model the client without proving live S3 setup.
