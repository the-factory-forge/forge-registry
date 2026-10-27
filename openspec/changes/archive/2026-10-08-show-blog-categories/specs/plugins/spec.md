## ADDED Requirements

### Requirement: Blog administration table

The administrative article table SHALL show assigned category names in the requested
locale, falling back to an available category translation. Long titles and category
lists SHALL truncate visually while retaining the full text for assistive technology.
Existing list adapters MAY omit category names until they refresh their source or data mapping.

#### Scenario: Scanning article categories

- **WHEN** staff view the article table
- **THEN** each article shows its current shared category assignments
- **AND** long text does not push the row actions out of the table

#### Scenario: Updating a custom list adapter

- **WHEN** an existing adapter supplies list items without category names
- **THEN** the table remains usable and shows an empty category indicator
- **AND** the host can supply names without a database migration
