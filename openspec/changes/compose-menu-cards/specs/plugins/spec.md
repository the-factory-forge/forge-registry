## ADDED Requirements

### Requirement: Optional main dish photo

The Menus editor SHALL offer an optional main-photo field with a preview during creation and editing. It SHALL reuse the image crop/adjustment workflow and private dish-scoped Drive storage. One selected file SHALL be the main photo; supplementary images SHALL stay private unless separately published through an authorized capability.

#### Scenario: Create with a cropped photo

- **WHEN** staff select a valid image, adjust its crop and save a new dish
- **THEN** the accepted image is uploaded and selected without another "Use this photo" step
- **AND** staff see the selected photo in the form
- **AND** the general Drive folder interface remains available for existing non-photo file-management uses

#### Scenario: Upload or association fails

- **WHEN** the dish is saved but upload or image association fails
- **THEN** the editor retains the saved dish identity, values and retryable photo state
- **AND** retry does not create another dish or overwrite a previous selected photo with a failed upload
- **AND** success is not reported for the complete photo operation until storage and association succeed

#### Scenario: Validate and protect images

- **WHEN** a client supplies an oversized, malformed, unready or foreign-scope image
- **THEN** server validation rejects it before public association
- **AND** selected images remain protected from Drive deletion and no signed private URL becomes a canonical public reference
- **AND** replacing or removing an image retains existing conflict checks and recoverable cleanup

### Requirement: Explicit dish visibility at creation

The Menus editor SHALL make dish visibility selectable before the first save, with an unchecked default. A successful save SHALL retain that choice. Card publication and availability SHALL independently control public access in card mode. Sold-out dishes SHALL remain visible when otherwise eligible.

#### Scenario: Choose visibility before creating

- **WHEN** staff create a dish with visibility selected
- **THEN** the service accepts that explicit choice and the saved editor shows it
- **AND** an unpublished card does not become public as a side effect
- **WHEN** staff leave visibility unchecked
- **THEN** the new dish stays hidden until an explicit saved change
