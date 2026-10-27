## ADDED Requirements

### Requirement: Menu printing

`@forge/menus` SHALL provide an SSR-compatible staff preview and browser printing
for the current visible menu on A4 portrait or A5 landscape paper. Hosts SHALL supply data,
branding, locale, currency, labels and authorized routes. Title and footer edits
SHALL last only for the current session. Printing SHALL NOT mutate catalog data,
save menu records or require storage changes.

#### Scenario: Print the current menu

- **WHEN** staff open the print preview
- **THEN** all visible dishes retain their category and item order, descriptions, all size prices, assigned allergen and dietary labels, spice information and sold-out text
- **AND** hidden dishes, empty categories, dish photos and guest filters are absent
- **AND** existing locale fallback and minor-unit currency behavior apply

#### Scenario: Select paper and print

- **WHEN** staff select A5, edit the title or optional footer and choose Print
- **THEN** the browser receives an isolated A5 landscape document containing the preview content and host branding
- **AND** navigation, staff controls and the host shell are absent
- **AND** the browser dialog supports printing or PDF saving, with natural pagination and no booklet imposition
- **AND** dishes and headings stay together where they fit, allowing an oversized dish to split without clipping

#### Scenario: Reopen or resize the preview

- **WHEN** staff reopen the page
- **THEN** it restores A4 and the supplied title/footer defaults without reading or writing saved presets
- **WHEN** staff use a narrow screen or dark theme
- **THEN** controls remain usable and the paper uses the host's light theme

#### Scenario: Empty menu or failed preparation

- **WHEN** there are no visible dishes
- **THEN** the preview explains the empty state and disables printing
- **WHEN** a required stylesheet, font or supplied logo cannot be prepared
- **THEN** printing reports an error, keeps the entered settings and permits retry
- **AND** successful preparation waits for styles, fonts and the optional logo before opening the dialog

#### Scenario: Untrusted text and repeated attempts

- **WHEN** staff enter markup in the title or footer
- **THEN** the document renders that input as text without executing it
- **WHEN** staff cancel, print again or leave the page
- **THEN** temporary print documents are removed without changing catalog data

#### Scenario: Install in an existing host

- **WHEN** a host updates Menus without supplying the optional print destination
- **THEN** its existing staff and public menu pages continue to work
- **AND** enabling printing requires the host to wire its own guarded route, branding, semantic theme and translated labels
- **AND** direct PDF generation, stored presets and a custom layout editor are not installed
