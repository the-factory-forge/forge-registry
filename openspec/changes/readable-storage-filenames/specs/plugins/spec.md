## ADDED Requirements

### Requirement: Readable storage object filenames

Drive and Blogs SHALL rebuild `[asset_name]-[type]-[modifier].[extension]` under
unique site/plugin directories. Hyphens SHALL separate fields; underscores SHALL
join words within a field. The first uploaded field SHALL supply the asset name;
the host context SHALL replace the type. Existing modifier fields SHALL be retained,
except `original`. Missing modifiers SHALL stay absent; uploads SHALL NOT invent
transformations. Fields SHALL use safe lowercase letters, digits and underscores.

#### Scenario: Recognizing an uploaded object

- **WHEN** an editor uploads `Annual Report.PDF` to a project Drive space
- **THEN** its staging and final object names end in `annual_report-project.pdf`
- **AND** UUID directories prevent same-name uploads from overwriting each other
- **WHEN** a blog upload called `Cover.JPG` contains validated PNG bytes
- **THEN** its object name is `cover-blog.png`

#### Scenario: Rebuilding a structured asset name

- **WHEN** `the_corner-logo_mark-white_bg.png` is uploaded to Blogs
- **THEN** the filename becomes `the_corner-blog-white_bg.png`
- **AND** the existing type is replaced rather than appended
- **WHEN** `the_corner-logo.png` is uploaded to a `menu-item` Drive scope
- **THEN** the filename becomes `the_corner-menu_item.png` without a modifier
- **WHEN** `cover-blog-original.jpg` is uploaded again
- **THEN** its name becomes `cover-blog.jpg`

#### Scenario: Selecting the extension

- **WHEN** Drive receives a filename with a usable extension
- **THEN** it preserves that extension in lowercase, otherwise using `.bin`
- **WHEN** Blogs validates PNG, JPEG or WebP bytes
- **THEN** the object uses `.png`, `.jpg` or `.webp` respectively

### Requirement: Compatible storage filename adoption

Stored names SHALL remain immutable across renames, copies and trash/restoration.
Existing unnamed keys and pending uploads SHALL remain usable. Drive adoption
SHALL add nullable persisted storage names before deploying updated writers and
maintenance workers together. Adoption SHALL NOT rename existing objects.

#### Scenario: Preserving legacy objects and shared bytes

- **WHEN** a host adopts readable filenames with existing objects or pending uploads
- **THEN** existing keys remain authoritative for completion, reads and cleanup
- **AND** renaming or duplicating an entry preserves its original object path
- **AND** deletion retains bytes until their last reference is removed
