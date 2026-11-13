## Purpose

Compose separate restaurant menus from reusable ordered categories without duplicating their dishes or exposing unpublished content.

## ADDED Requirements

### Requirement: Menu composition

Menus SHALL have translated names, optional descriptions, an explicit publication state, an optional availability period and a display mode. Menus SHALL reference ordered categories. Categories SHALL retain one identity, optional descriptions and their dishes across every menu using them. One dish SHALL belong to at most one category.

#### Scenario: Share a drinks category

- **WHEN** staff add the same category to Restaurant and Brasserie
- **THEN** its content and dish identities are shared while each menu retains its own category ordering
- **AND** later common-category edits appear in both menus
- **AND** detaching from Restaurant preserves Brasserie, the category, its dishes and files

#### Scenario: Preserve genuinely different offers

- **WHEN** dishes have different prices or descriptions in two offers
- **THEN** staff can keep them in independent categories rather than silently overwriting one offer through sharing

### Requirement: Menu types

Staff SHALL choose standard, set or weekly at creation. Standard and set menus SHALL use the same category and dish model. A weekly menu SHALL group dishes by selected weekdays and course, showing a grid on wide screens and paper and days stacked on small screens.

#### Scenario: Create next week’s menu

- **WHEN** staff create the next week from an existing dated weekly menu
- **THEN** the next calendar week uses the selected weekdays and starts with new empty categories
- **AND** the new menu remains unpublished until staff explicitly publish it
- **AND** changes to one week do not affect another

### Requirement: Grouped category management

The menu editor SHALL show collapsible category sections with indented dish rows, in-context category/dish creation and aligned row actions. Existing-category choices SHALL display names only. Shared categories SHALL identify their participating menus and direct edits through an explicitly labeled common-category context.

#### Scenario: Edit a common category

- **WHEN** staff inspect a shared category inside a menu
- **THEN** its content controls are read-only there and its shared indicator lists affected menus
- **AND** "Edit common category" opens an editing context that names those menus before saving
- **AND** allergen/dietary catalog management remains a separate global action

#### Scenario: Detach a category

- **WHEN** staff detach a category from a menu
- **THEN** its dishes and files remain intact, and an unattached category can be found and reused

### Requirement: Preserve dishes when deleting a category

Category deletion SHALL offer keeping dishes by default or explicitly deleting them. Shared and weekly categories SHALL remain protected. The [design decision](../../design.md#menus-reuse-categories) explains why reorganizing menus preserves reusable dishes.

#### Scenario: Keep dishes for later use

- **WHEN** staff confirm deletion while keeping dishes
- **THEN** the category is removed and its dishes become unassigned, retaining their identities, content, labels and private files
- **AND** staff find them below the menus and can reassign them through the item editor
- **AND** public menus, public image reads and printing exclude them regardless of saved visibility

#### Scenario: Delete category contents explicitly

- **WHEN** staff explicitly confirm deleting the category and its dishes
- **THEN** authorization and file protections apply to the whole operation; a protected dish or file leaves all records unchanged

#### Scenario: Reject an outdated confirmation

- **WHEN** a nonempty category's dish IDs or versions differ from the confirmed snapshot
- **THEN** the whole operation is rejected without changing the category or dishes, and staff can review refreshed contents before retrying

#### Scenario: Preserve older deletion callers

- **WHEN** a host omits the new deletion options
- **THEN** only empty categories can be deleted; existing dishes and their assignments stay intact

### Requirement: Current menu editing context

The editor SHALL support ordered menus with one sticky current menu heading. Preview/settings SHALL remain beside the relevant title, with printing inside Preview. Scroll changes SHALL NOT retarget unsaved edits. Hosts SHALL own URLs and progressive loading.

#### Scenario: Move from Restaurant to Brasserie

- **WHEN** staff scroll from Restaurant into Brasserie
- **THEN** Brasserie becomes the current heading and its actions stay beside the title
- **AND** the previous heading leaves without accumulating sticky titles
- **AND** any open edit remains associated with its original record until saved or cancelled
- **AND** controls remain usable on narrow screens without obscuring focused content

### Requirement: Common label catalogue and discrete spice control

All menus SHALL use one common allergen/dietary label catalogue with independent per-dish assignments. Staff SHALL configure that catalogue once, rather than through a separate settings surface for each menu. The spice input SHALL expose the existing values 0, 1, 2 and 3 as four labeled slider stops with keyboard operation; no intermediate value SHALL be stored.

#### Scenario: Configure once and assign separately

- **WHEN** staff edit a catalogue label and select it on one dish
- **THEN** every menu uses that same catalogue definition
- **AND** other dishes keep their previous selections
- **AND** a host installing available presets does not assign labels to dishes

### Requirement: Authorized atomic movement

Category order within a menu and dish order within a category SHALL support pointer/touch dragging and keyboard alternatives. Moving a dish between categories SHALL be explicit, available without dragging and protected by current versions and authorization. Stale or invalid moves SHALL leave all affected data unchanged and retain usable current rows with an error.

#### Scenario: Reorder or move

- **WHEN** staff reorder sections or move a dish to a different category
- **THEN** the accepted order and category survive refresh without changing names, prices or media
- **AND** valid drop targets make room before the drop, respecting reduced motion
- **AND** the public and print projections follow that same order
- **AND** the common-category context makes the consequences for other menus clear before editing shared content

#### Scenario: Concurrent change

- **WHEN** another writer changes membership or a version while a move is pending
- **THEN** the entire stale operation is rejected without partial positions or lost dishes
- **AND** the editor reloads canonical data and offers a retry

### Requirement: Explicit publication gates

Menus SHALL start unpublished with one clickable publication status. Public menu and image reads SHALL require publication, an eligible host-evaluated period and dish visibility. Saving a visible dish SHALL update its current content without a separate draft snapshot.

#### Scenario: Change publication once

- **WHEN** staff activate the menu's publication status
- **THEN** its state is communicated independently of color, duplicate pending writes are prevented and failures restore a usable state with an error
- **AND** no second Publish/Unpublish control duplicates that action

#### Scenario: Unpublish a shared dish's last live menu

- **WHEN** no published eligible menu contains a visible dish
- **THEN** the public menu and image endpoint deny access to that dish
- **AND** supplementary Drive files remain private
- **WHEN** another live menu still contains that category
- **THEN** its eligible dishes remain publicly accessible through that menu

### Requirement: Menu view modes and filters

Menus SHALL support lines or photos selected by staff. Photo rows SHALL align text left, an optional photo in the middle and prices right, preserving the columns and the same minimum row height/spacing when a photo is absent. Long content SHALL remain readable without clipping. Portable controls SHALL expose values and callbacks for host-owned URL state. Existing translations, sizes, labels, sold-out status and combined filters SHALL remain available.

#### Scenario: Mixed image availability

- **WHEN** adjacent dishes include one with a photo and one without
- **THEN** names and prices retain their respective column alignment at narrow and wide widths
- **AND** a missing or failed photo leaves a neutral placeholder in photo mode
- **AND** public view follows the saved mode and retains allergen exclusion and dietary preference filters
- **AND** clearing filters restores the same menu without changing its category order

### Requirement: Optional individual prices

Dishes SHALL support an absent individual price distinct from zero. Existing numeric prices and priced sizes SHALL retain their value. Staff MAY change the menu’s displayed currency label without converting prices. The existing translated menu/category descriptions SHALL support set-menu forfaits and inclusions as editorial content displayed in web and paper views. These descriptions SHALL NOT create automatic totals, price inheritance or ordering rules.

#### Scenario: Present two set menus at one forfait

- **WHEN** a menu description states "88 CHF per person" and its categories "Menu I" and "Menu II" contain dishes without individual prices
- **THEN** public, staff preview and print views show the description and ordered dishes without invented prices or free/included labels
- **AND** saving an empty price does not turn it into zero
- **AND** an explicitly entered zero remains distinct from an absent price

### Requirement: Private guest-facing preview

Staff preview SHALL use the guest-facing renderer with saved menu content and SHALL permit authorized inspection before publication. Opening the preview SHALL neither publish content nor expose unpublished records through anonymous reads.

#### Scenario: Inspect an unpublished menu

- **WHEN** authorized staff open its preview
- **THEN** they see the intended web layout with saved descriptions, dishes and configured display mode
- **AND** the menu remains unpublished and inaccessible to anonymous visitors

#### Scenario: Switch from web to paper

- **WHEN** staff open Preview and switch between Web and Paper
- **THEN** the same saved menu is rendered for the chosen medium, with no dish photos in Paper
- **AND** the Paper view exposes print settings and a Print action that opens the browser print dialog
- **AND** switching views does not print or publish, and cancelling the browser dialog leaves content and publication unchanged

### Requirement: Printing one menu

The printer SHALL accept one selected menu's visible dish projection, including its attached common categories. It SHALL omit photos, hidden dishes and visitor filters while preserving the existing print preparation, translations, sizes, labels, host branding and retry behavior. Staff SHALL be able to preview and print an unpublished menu internally.

#### Scenario: Print Restaurant

- **WHEN** staff print Restaurant containing a common Drinks section
- **THEN** Restaurant and Drinks appear but Brasserie-only categories do not
- **AND** names and descriptions do not overlap prices, and a category heading stays with its first dish
- **AND** the next category shares the current page if it fits and can span pages if it is longer than one page
- **AND** allergen and dietary symbols have a legend; spicy dishes use one to three flames without a visible spice label
- **AND** no photo, staff control or sidebar enters the print document

### Requirement: Explicit additive adoption

Existing flat-menu integrations SHALL remain usable until their hosts adopt composed-menu operations and an additive data migration. Installation SHALL NOT create customer menus, publish records, change stored identities or migrate object keys. New operations SHALL use the existing host transport, locks, validation and authorization conventions.

#### Scenario: Upgrade a populated host

- **WHEN** a host installs the new source before adopting composed menus
- **THEN** its existing public/list/editor interfaces retain their documented behavior
- **AND** a reviewed forward migration permits unassigned dishes and can attach existing categories without resetting items, images, labels, versions or applied migration history
