## MODIFIED Requirements

### Requirement: Drive plugin

`@forge/drive` SHALL provide `DrivePage` and embeddable `DriveBrowser` using a
`DriveClient`. A space SHALL be scoped by host-defined entity type and ID.
The browser SHALL support folders, sorting, pagination, uploads with progress,
retry/cancel, downloads, rename and confirmed deletion according to capabilities.
The browser SHALL combine directory, space and folder navigation into one
breadcrumb. Ancestors SHALL navigate back and clicking the current title SHALL
enter inline edit mode when renaming is permitted, without an action arrow or
menu. Keyboard activation SHALL also enter edit mode with the current name
selected. Enter or leaving the field SHALL save; Escape SHALL discard the draft.
Pending saves SHALL prevent edits and duplicate submissions, and IME confirmation
SHALL NOT submit. Folder renames SHALL use the existing
Drive client and rename capability. Space renaming SHALL require an optional
host callback, independent of file permissions. The host SHALL validate, authorize
and persist changes to its record and refresh listing names. Adapters without
that callback SHALL remain compatible and SHALL NOT offer space renaming.
Failed renames SHALL retain the inline field and entered name for retry,
with accessible error feedback that does not move the file table.

Upload feedback SHALL appear in the browser's fixed toast area without moving
page content. Each file SHALL retain progress, state and retry/cancel controls.
Active uploads and failures SHALL stay available until resolved; finished batches
SHALL dismiss after five seconds, paused while hovered or focused, or on request.
Asynchronous toast feedback SHALL update in place through loading, success and
error states. Loading indicators SHALL respect reduced motion. Failed requests
SHALL retain recovery controls or leave the initiating action available for retry.

`@forge/drive-storage` SHALL provide `createDriveStorage`, PostgreSQL metadata,
private S3-compatible object storage and server-authorized scope access.
Projects may own spaces; customers reach files through their projects rather
than a separate customer Drive section. Other features may supply their own scopes.

#### Scenario: Opening another entity's space

- **WHEN** a client requests a Drive space
- **THEN** the host resolves that scope and checks access before listing or mutating files
- **AND** capabilities shown by the browser do not grant server permission

#### Scenario: Renaming from the breadcrumb

- **WHEN** an authorized user clicks or keyboard-activates the current title and edits its name
- **THEN** Enter or leaving the field saves and the breadcrumb and subsequent listings show the saved name
- **AND** Escape discards an unsaved draft and returns focus to the title
- **AND** ancestor links remain usable, while a failed save preserves the draft for retry
- **AND** a space without a host rename callback shows no rename action

#### Scenario: Upload feedback

- **WHEN** a user uploads files in a standalone or embedded browser
- **THEN** a fixed toast shows each file's progress and recovery controls without shifting the file table
- **AND** failures remain retryable, large batches scroll, and finished feedback dismisses without removing uploaded files

#### Scenario: Asynchronous operation feedback

- **WHEN** a user downloads a file, undoes trashing or uploads a batch
- **THEN** its toast shows loading feedback and updates in place when the operation settles
- **AND** errors remain recoverable, reduced motion is respected, and file-table content does not shift
