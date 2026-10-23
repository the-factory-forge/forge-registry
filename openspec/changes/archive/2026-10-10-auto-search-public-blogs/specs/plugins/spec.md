## MODIFIED Requirements

### Requirement: Blogs plugin

`@forge/blogs` SHALL provide article administration, language tabs, Markdown
editing/preview, categories and public list/article components. Articles SHALL
group translations with independent drafts and published snapshots. Shared
images and category assignments SHALL be captured for the published language;
unpublished edits SHALL NOT change a public translation. Missing public
translations SHALL NOT silently fall back to another language.
`@forge/blogs-storage` SHALL provide `createBlogsStorage` with PostgreSQL and
private S3 persistence, fresh staff authorization, version checks and idempotent
mutations. Blogs SHALL remain independent of Customers, Projects and Drive.
Published, unpublished changes and draft SHALL use success, pending and
not-started colors in both list and editor.

Public search SHALL submit after typing pauses without a separate Search button.
Clearing the field SHALL refresh results. Search SHALL preserve the selected
category, reset pagination and retain immediate Enter submission through the
existing GET form.

#### Scenario: Searching public articles

- **WHEN** a visitor finishes typing or clears the search field
- **THEN** the listing updates automatically for that query and the selected category
- **AND** Enter submits immediately without a duplicate delayed submission
- **AND** unfinished text composition does not submit a search

#### Scenario: Editing a published translation

- **WHEN** staff save a new draft for a published language
- **THEN** its status becomes unpublished changes
- **AND** the public page retains its previous publication until staff publish again
