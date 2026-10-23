## MODIFIED Requirements

### Requirement: Drive folder action menu

Drive folder-tree rows SHALL offer a keyboard- and touch-accessible three-dot menu
with permitted Add > Upload file / Upload folder / Folder, Rename, Duplicate, Download and Move to
trash actions. Actions SHALL target the selected row independently of the open
folder. Labels SHALL remain translatable and theme-aware. Rename and trash SHALL
retain existing validation and confirmation flows.

#### Scenario: Acting on a different folder

- **WHEN** a user opens a folder's tree menu while another folder is displayed
- **THEN** its actions affect the selected folder
- **AND** trashing the open folder or an ancestor offers its parent and authorized Undo
- **AND** Move to trash requires the complete trash integration and never substitutes permanent deletion

#### Scenario: Creating a child folder

- **WHEN** a user chooses Add > Folder on a tree row
- **THEN** the existing creation dialog creates a child of that folder
- **AND** a different open folder never displays the new child during optimistic feedback
- **AND** folder creation remains available with create-folder permission independently of upload permission

## ADDED Requirements

### Requirement: Drive folder downloads

Folder downloads SHALL save a ZIP with nested files and empty folders using the
existing authorized reads. The browser SHALL traverse every cursor page, validate
paths, bound memory use and fail without saving a partial ZIP. Download-only
access SHALL suffice without a new client method. Hosts SHALL permit CORS GET
access for signed URLs.

#### Scenario: A folder exceeds browser limits

- **WHEN** the tree exceeds 100 MB of file bytes, 1,000 entries including folders or 100 nested levels
- **THEN** the archive is rejected with a translated limit message and guidance to download smaller subfolders
- **AND** the byte limit covers both declared metadata and actual streamed bytes

#### Scenario: Downloading a folder from another view

- **WHEN** a user with download permission chooses Download on a folder-tree row
- **THEN** the ZIP contains that folder's complete paginated tree, including empty folders
- **AND** the existing download toast reports progress and completion without shifting the table

#### Scenario: Download failure or cancellation

- **WHEN** a read fails, access is revoked, a path is unsafe or a limit is exceeded
- **THEN** no partial ZIP is saved and a translated error allows the user to retry or choose smaller subfolders
- **WHEN** the user leaves the Drive browser during an archive download
- **THEN** active archive reads are cancelled
