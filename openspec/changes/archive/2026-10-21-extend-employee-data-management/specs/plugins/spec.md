## ADDED Requirements

### Requirement: Employee deletion with related data

Employees SHALL support host-provided deletion previews grouped by data source,
with links, explicit decisions and optional replacement identities. Single and bulk
deletion SHALL use the same configured adapter. Hosts SHALL validate fresh admin
authorization, preview versions, complete choices and eligible replacements, then
atomically process related data and account removal. Self-deletion SHALL fail.
The default provider-removal path SHALL NOT bypass a configured transaction.

#### Scenario: Reviewing articles and another plugin's records

- **WHEN** an administrator opens deletion for an employee with related records
- **THEN** the dialog shows each supplied group and expandable affected-item links
- **AND** confirmation requires the group's valid choice and any required replacement

#### Scenario: Related data changes or processing fails

- **WHEN** confirmation uses a stale preview or any related operation fails
- **THEN** no partial account deletion is reported as successful
- **AND** the dialog retains feedback and can reload the preview

### Requirement: Optional optimized employee photos

Employee photo controls SHALL remain optional and show a placeholder without a
photo. Configured uploads SHALL use the shared crop dialog to prepare WebP bytes
before upload. Hosts MAY override output dimensions. Invalid images and failed
uploads SHALL preserve other edits and allow retry or cancellation.

#### Scenario: Uploading or omitting a photo

- **WHEN** an employee has no photo
- **THEN** the photo control imposes no required-file validation
- **WHEN** the employee selects an image
- **THEN** crop confirmation prepares the configured WebP output before upload

#### Scenario: Employee photo upload fails

- **WHEN** image decoding or the host upload fails
- **THEN** accessible feedback supports retry or cancellation
- **AND** unrelated form values remain intact
