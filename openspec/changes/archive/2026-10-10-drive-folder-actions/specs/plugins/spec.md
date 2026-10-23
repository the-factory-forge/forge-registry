## ADDED Requirements

### Requirement: Drive folder action menu

Drive folder-tree rows SHALL offer a keyboard- and touch-accessible three-dot menu
with permitted Add > Upload file / Upload folder, Rename, Duplicate and Move to
trash actions. Actions SHALL target the selected row independently of the open
folder. Labels SHALL remain translatable and theme-aware. Rename and trash SHALL
retain existing validation and confirmation flows.

#### Scenario: Acting on a different folder

- **WHEN** a user opens a folder's tree menu while another folder is displayed
- **THEN** its actions affect the selected folder
- **AND** trashing the open folder or an ancestor offers its parent and authorized Undo
- **AND** Move to trash requires the complete trash integration and never substitutes permanent deletion

### Requirement: Drive directory upload

Directory uploads SHALL require upload and folder-creation permissions. The
companion SHALL validate paths and folder depth, preserve subfolders, reuse
matching ready folders and reject file conflicts without overwriting. Each file
SHALL retain its target, path, progress, request identity and retry/cancel behavior.

#### Scenario: Uploading a directory

- **WHEN** a permitted user selects a directory containing nested files
- **THEN** each file retains its relative path inside the selected destination
- **AND** a failed file remains retryable without overwriting or flattening its path
- **AND** unsafe paths and unavailable destinations are rejected by the server
- **AND** the browser picker omits empty directories, while cancellation can leave created folders and completed files

### Requirement: Drive duplication

Duplication SHALL require download, upload and folder-creation permissions. It
SHALL create an independent sibling subtree with fresh entry IDs and a
user-confirmed name atomically. Conflicts, inaccessible IDs and unfinished source
operations SHALL fail without partial copies.

#### Scenario: Duplicating a folder

- **WHEN** a permitted user duplicates a ready folder
- **THEN** its nested entries receive new IDs and the root receives the chosen name
- **AND** renaming or trashing either copy leaves the other unchanged
- **AND** a failed form keeps its entered name for retry

### Requirement: Drive copy storage lifetime

Copies MAY share immutable stored bytes. Permanent deletion SHALL retain bytes
referenced by any other active or trashed entry. All writers and cleanup workers
SHALL adopt reference-aware cleanup before enabling duplication.

#### Scenario: Removing a copy

- **WHEN** either copy is permanently deleted
- **THEN** the surviving copy retains its downloadable bytes
- **AND** a copy in trash remains recoverable until expiry
- **AND** the last permanent removal releases the shared stored bytes

### Requirement: Optional Drive folder operations

`prepareFolderUpload` and `duplicateEntry` SHALL remain optional client methods.
Server authorization SHALL be rechecked under the space lock. Hosts SHALL wire
validated, explicit transport operations. Installation SHALL NOT change a host's
transport, authentication or database automatically.

#### Scenario: An older host adapter

- **WHEN** an adapter omits directory upload, duplication or trash methods
- **THEN** the corresponding menu action is omitted and existing actions continue working
- **AND** UI capabilities never grant server access
