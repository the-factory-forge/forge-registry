## ADDED Requirements

### Requirement: Drive trash and restoration

The initial Drive SQL and Drizzle schema SHALL include trash. Drive SHALL support
opt-in trash with a 30-day default retention window. Custom adapters without trash
SHALL remain compatible and
`deleteEntry` SHALL retain permanent deletion semantics. Trash-enabled browsers
SHALL use confirmed trash for routine deletion and separately confirmed permanent
purge. Recovery SHALL require an explicit restore capability; a renamed recovery
SHALL also require rename permission. Server authorization SHALL remain authoritative.

After confirmed trashing, the browser SHALL offer a toast Undo action when restore
permission is granted. Undo SHALL use the existing authorized restore operation,
prevent duplicate pending submissions and refresh active/trash listings. Failures
SHALL remain retryable; location or name conflicts SHALL offer the Trash recovery
flow without overwriting active files. Permanent deletion SHALL NOT offer Undo.

Trash SHALL retain group IDs, descendant relationships, immutable bytes, original
location and expiry. Trashed groups SHALL remain independent from later deletion
of their former ancestors. Normal listings, search, downloads and trusted file
reads SHALL exclude trash. Active names MAY be reused. Restoration SHALL validate
an available same-space destination and name, expiry and folder depth without
overwriting existing entries. Unavailable locations or name collisions SHALL offer
an explicit destination/name recovery flow.

Trashing SHALL validate the deletion preview and host reference guard and SHALL
reject unfinished uploads or pending deletion in the affected subtree. Menus
SHALL reject trashed image references and reads. Trash and pending purge SHALL
block owning-entity removal. Expiry cleanup SHALL use bounded trusted maintenance
and durable retries; storage failures SHALL retain recovery metadata until cleanup
succeeds. Permanent purge SHALL prevent restoration once started.

#### Scenario: Recovering a folder

- **WHEN** an authorized user trashes a folder and restores it before expiry
- **THEN** its IDs, descendants and bytes survive and it returns to its original available folder
- **AND** trash shows its original location and expiry while normal file access excludes it

#### Scenario: Recovering after a location or name conflict

- **WHEN** the original folder is unavailable or an active item now uses the name
- **THEN** recovery refuses to overwrite and offers an available name and same-space folder
- **AND** independently trashed children remain recoverable after their former parent is purged

#### Scenario: Retrying permanent cleanup

- **WHEN** confirmed purge or retention expiry encounters a storage failure
- **THEN** pending metadata survives and a later bounded maintenance pass can finish after restart
- **AND** the pending group cannot be restored or bypass the owning-entity deletion guard

#### Scenario: Protecting in-progress uploads and menu images

- **WHEN** a subtree contains unfinished uploads, pending deletion or a guarded menu image reference
- **THEN** trashing is rejected without removing its files
- **AND** Menus cannot select or read an image already in trash

#### Scenario: Undoing a trash action

- **WHEN** an authorized user activates Undo on the trash confirmation toast
- **THEN** the item returns to its original available location and pending clicks cannot duplicate the operation
- **AND** a failed request remains retryable, while a location or name conflict offers Trash recovery without overwriting files

#### Scenario: Installing Drive

- **WHEN** a host installs Drive
- **THEN** the initial schema supports trash without a separate upgrade
- **AND** transport operations and recovery permission require explicit host adoption, while adapters without trash retain permanent deletion
