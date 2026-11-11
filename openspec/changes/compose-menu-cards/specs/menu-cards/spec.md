## Purpose

Compose separate restaurant cards from reusable ordered categories without duplicating their dishes or exposing unpublished content.

## ADDED Requirements

### Requirement: Thin card compositions

Cards SHALL have translated names, optional descriptions, an explicit publication state, an optional availability period and a display mode. Cards SHALL reference ordered categories. Categories SHALL retain one identity, optional descriptions and their dishes across every card using them. One dish SHALL belong to one category.

#### Scenario: Share a drinks category

- **WHEN** staff add the same category to Restaurant and Brasserie
- **THEN** its content and dish identities are shared while each card retains its own category ordering
- **AND** later common-category edits appear in both cards
- **AND** detaching from Restaurant preserves Brasserie, the category, its dishes and files

#### Scenario: Preserve genuinely different offers

- **WHEN** dishes have different prices or descriptions in two offers
- **THEN** staff can keep them in independent categories rather than silently overwriting one offer through sharing

### Requirement: Grouped category management

The card editor SHALL show collapsible category sections with indented dish rows, in-context category/dish creation and aligned row actions. Existing-category choices SHALL display names only. Shared categories SHALL identify their participating cards and direct edits through an explicitly labeled common-category context.

#### Scenario: Edit a common category

- **WHEN** staff inspect a shared category inside a card
- **THEN** its content controls are read-only there and its shared indicator lists affected cards
- **AND** "Edit common category" opens an editing context that names those cards before saving
- **AND** allergen/dietary catalog management remains a separate global action

### Requirement: Current-card editing context

The editor SHALL support ordered cards with one sticky current-card heading. Preview/settings SHALL remain beside the relevant title, with printing inside Preview. Scroll changes SHALL NOT retarget unsaved edits. Hosts SHALL own URLs and progressive loading.

#### Scenario: Move from Restaurant to Brasserie

- **WHEN** staff scroll from Restaurant into Brasserie
- **THEN** Brasserie becomes the current heading and its actions stay beside the title
- **AND** the previous heading leaves without accumulating sticky titles
- **AND** any open edit remains associated with its original record until saved or cancelled
- **AND** controls remain usable on narrow screens without obscuring focused content

### Requirement: Common label catalogue and discrete spice control

All cards SHALL use one common allergen/dietary label catalogue with independent per-dish assignments. Staff SHALL configure that catalogue once, rather than through a separate settings surface for each card. The spice input SHALL expose the existing values 0, 1, 2 and 3 as four labeled slider stops with keyboard operation; no intermediate value SHALL be stored.

#### Scenario: Configure once and assign separately

- **WHEN** staff edit a catalogue label and select it on one dish
- **THEN** every card uses that same catalogue definition
- **AND** other dishes keep their previous selections
- **AND** a host installing available presets does not assign labels to dishes

### Requirement: Authorized atomic movement

Category order within a card and dish order within a category SHALL support pointer/touch dragging and keyboard alternatives. Moving a dish between categories SHALL be explicit, available without dragging and protected by current versions and authorization. Stale or invalid moves SHALL leave all affected data unchanged and retain usable current rows with an error.

#### Scenario: Reorder or move

- **WHEN** staff reorder sections or move a dish to a different category
- **THEN** the accepted order and category survive refresh without changing names, prices or media
- **AND** the public and print projections follow that same order
- **AND** the common-category context makes cross-card consequences clear before editing shared content

#### Scenario: Concurrent change

- **WHEN** another writer changes membership or a version while a move is pending
- **THEN** the entire stale operation is rejected without partial positions or lost dishes
- **AND** the editor reloads canonical data and offers a retry

### Requirement: Explicit publication gates

Cards SHALL start unpublished with one clickable publication status. Public card and image reads SHALL require publication, an eligible host-evaluated period and dish visibility. Saving a visible dish SHALL update its current content without a separate draft snapshot.

#### Scenario: Change publication once

- **WHEN** staff activate the card's publication status
- **THEN** its state is communicated independently of color, duplicate pending writes are prevented and failures restore a usable state with an error
- **AND** no second Publish/Unpublish control duplicates that action

#### Scenario: Unpublish a shared dish's last live card

- **WHEN** no published eligible card contains a visible dish
- **THEN** the card-mode public menu and image endpoint deny access to that dish
- **AND** supplementary Drive files remain private
- **WHEN** another live card still contains that category
- **THEN** its eligible dishes remain publicly accessible through that card

### Requirement: Card view modes and filters

Cards SHALL support lines or photos selected by staff. Photo rows SHALL align text left, an optional photo in the middle and prices right, preserving the columns and the same minimum row height/spacing when a photo is absent. Long content SHALL remain readable without clipping. Portable controls SHALL expose values and callbacks for host-owned URL state. Existing translations, sizes, labels, sold-out status and combined filters SHALL remain available.

#### Scenario: Mixed image availability

- **WHEN** adjacent dishes include one with a photo and one without
- **THEN** names and prices retain their respective column alignment at narrow and wide widths
- **AND** public view follows the saved mode
- **AND** clearing filters restores the same card without changing its category order

### Requirement: Optional individual prices

Dishes SHALL support an absent individual price distinct from zero. Existing numeric prices and priced sizes SHALL retain their value. The existing translated card/category descriptions SHALL support set-menu forfaits and inclusions as editorial content displayed in web and paper views. These descriptions SHALL NOT create automatic totals, price inheritance or ordering rules.

#### Scenario: Present two set menus at one forfait

- **WHEN** a card description states "88 CHF per person" and its categories "Menu I" and "Menu II" contain dishes without individual prices
- **THEN** public, staff preview and print views show the description and ordered dishes without invented prices or free/included labels
- **AND** saving an empty price does not turn it into zero
- **AND** an explicitly entered zero remains distinct from an absent price

### Requirement: Private guest-facing preview

Staff preview SHALL use the guest-facing renderer with saved card content and SHALL permit authorized inspection before publication. Opening the preview SHALL neither publish content nor expose unpublished records through anonymous reads.

#### Scenario: Inspect an unpublished card

- **WHEN** authorized staff open its preview
- **THEN** they see the intended web layout with saved descriptions, dishes and configured display mode
- **AND** the card remains unpublished and inaccessible to anonymous visitors

#### Scenario: Switch from web to paper

- **WHEN** staff open Preview and switch between Web and Paper
- **THEN** the same saved card is rendered for the chosen medium, with no dish photos in Paper
- **AND** the Paper view exposes print settings and a Print action that opens the browser print dialog
- **AND** switching views does not print or publish, and cancelling the browser dialog leaves content and publication unchanged

### Requirement: Selected-card printing

The printer SHALL accept one selected card's visible dish projection, including its attached common categories. It SHALL omit photos, hidden dishes and visitor filters while preserving the existing print preparation, translations, sizes, labels, host branding and retry behavior. Staff SHALL be able to preview and print an unpublished card internally.

#### Scenario: Print Restaurant

- **WHEN** staff print Restaurant containing a common Drinks section
- **THEN** Restaurant and Drinks appear but Brasserie-only categories do not
- **AND** no photo, staff control or sidebar enters the print document

### Requirement: Explicit additive adoption

Existing flat-menu integrations SHALL remain usable until their hosts adopt card operations and an additive data migration. Installation SHALL NOT create customer cards, publish records, change stored identities or migrate object keys. New operations SHALL use the existing host transport, locks, validation and authorization conventions.

#### Scenario: Upgrade a populated host

- **WHEN** a host installs the new source before opting into cards
- **THEN** its existing public/list/editor interfaces retain their documented behavior
- **AND** a reviewed forward migration can attach existing categories without resetting items, images, labels, versions or applied migration history
