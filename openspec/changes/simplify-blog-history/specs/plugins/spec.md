# Spec Delta

## MODIFIED Requirements

### Requirement: Blogs plugin

`@forge/blogs` SHALL provide article administration, language tabs, Markdown
editing/preview, categories and public list/article components. Its Blog editor
module SHALL own article and category editing, saved state, asynchronous completion
and unsaved-change protection independently of the Menu editor, preserving the existing page interfaces.
Each article language SHALL have at most one saved draft and five publications,
including its live publication, with chronological history and the existing detailed comparison.

#### Scenario: Rejecting malformed service requests

- **WHEN** a host passes malformed request data to the server companion
- **THEN** Zod validates the input before its fields reach storage and failures use the plugin's `INVALID` error
- **AND** parsed objects exclude unknown fields while existing authorization and business rules remain enforced
- **AND** optional inputs retain their documented omission semantics

#### Scenario: Editing and publishing translations

- **WHEN** staff edit or publish a blog article
- **THEN** Articles SHALL
  group translations with independent drafts, publications and retained history.
  Complete content, designated author, image references and category assignments
  SHALL be captured for each saved language state; unpublished edits SHALL NOT
  change a public translation. Missing public translations SHALL NOT silently
  fall back to another language.
  `@forge/blogs-storage` SHALL provide `createBlogsStorage` with PostgreSQL and
  private S3 persistence, fresh staff authorization, version checks and idempotent
  mutations. Blogs SHALL remain independent of Customers, Projects and Drive.
  Published, unpublished changes and draft SHALL use success, pending and
  not-started colors in both list and editor.

#### Scenario: Reading a blog status

- **WHEN** a blog translation is published, has unpublished changes, or is a draft
- **THEN** its editor and list badge use the same green, orange, or gray status pair respectively
- **AND** its translated status remains available as text without relying on color alone

#### Scenario: Submitting public blog search

- **WHEN** a visitor types in or clears the public blog search
- **THEN** Public search SHALL submit after typing pauses without a separate Search button.
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

#### Scenario: Scrolling the editor history

- **WHEN** staff scroll an article with history open on desktop
- **THEN** the comparison and History buttons stick together with the history panel below the host header offset
- **AND** long timelines scroll inside the panel while the buttons remain visible
- **AND** narrow layouts retain the controls and expanded history in normal page flow

#### Scenario: Opening and closing History

- **WHEN** the Blog History panel opens by default or through its toggle
- **THEN** the toggle has a filled primary treatment and exposes `aria-expanded="true"`
- **AND** closing through the toggle, panel close action or mobile version selection restores its inactive outline and `aria-expanded="false"`

#### Scenario: Computing a draft save

- **WHEN** a storage or showroom adapter saves a blog draft
- **THEN** one pure model operation validates content and computes the article, retained history snapshot and removed history IDs together
- **AND** unchanged content and settings preserve the prior article version, editor and history
- **AND** the operation leaves its caller-owned inputs unchanged
- **AND** the storage adapter retains authorization, locking and atomic persistence of the article, history, projections and retry result

#### Scenario: Keeping an editor draft safe during navigation and refresh

- **WHEN** staff leave an unsaved draft for another language or history version
- **THEN** the editor offers save, discard and cancel; a failed save retains the draft and pending navigation
- **AND** retrying unchanged input retains its request ID and navigation continues only after a successful save
- **AND** explicit article refresh adopts the latest version while retaining dirty content, settings and history origin
- **AND** obsolete history responses cannot replace the current client's headers or selected version
- **AND** clients without history retain direct publication through the existing client interface

#### Scenario: An obsolete Blog editor operation finishes

- **WHEN** a save, refresh, publication, history operation, upload or deletion finishes after its article/language editor or category editor has been replaced, unmounted or given a replacement client
- **THEN** the old completion does not update editor state, produce success/error feedback, invoke host callbacks or resume navigation
- **AND** obsolete publication plans cannot open confirmations or start publication
- **AND** already-submitted server writes may finish without affecting the replacement editor
- **AND** an obsolete attempt cannot clear a newer attempt's pending state or retry identity

#### Scenario: Replacing only the Blog editor client

- **WHEN** the host supplies a different client for the same article/language or category
- **THEN** unsaved inputs remain intact while obsolete pending state, feedback and confirmations are cleared
- **AND** subsequent attempts use the replacement client and a fresh retry identity, even when a prior client object is later reused
- **AND** unchanged retries within the same client retain their request ID and existing version checks
- **AND** current successful saves and confirmed deletions retain their normal host callbacks and navigation

#### Scenario: Browser history leaves an unsaved blog draft

- **WHEN** a host router blocks Back or Forward away from a dirty blog editor
- **THEN** the existing save, discard and cancel dialog resolves the original transition
- **AND** cancel preserves the current language, URL and draft; discard leaves without saving
- **AND** save persists the current language and shared settings before leaving; invalid fields cancel navigation and failures retain the draft for retry
- **AND** pending operations reject new route changes, and replaced editors cannot resume an earlier save's navigation
- **AND** clean navigation and confirmed deletion return normally, without synthetic history entries
- **AND** document exits use the native browser warning while dirty or pending, without repeating it after confirmed Save or Discard

#### Scenario: Browser history leaves an unsaved blog category

- **WHEN** a host router blocks Back or Forward away from an edited or new category
- **THEN** the category editor offers Save category, Discard changes and Cancel
- **AND** Cancel retains all translations, slugs and parent selection; Discard resumes the original transition without saving
- **AND** Save persists before resuming the transition, while errors retain the draft and dialog for retry
- **AND** pending saves reject new route changes, and native unload warns while dirty or pending

### Requirement: Stable blog version identity

An explicit save of changed publication inputs SHALL create one saved draft
version that replaces the previous saved draft. Unchanged saves and publishing a saved state SHALL NOT create duplicate
content versions. Drafts SHALL use their translated draft label without a visible
version number. Only publishing a new draft SHALL allocate the next visible
publication number, using the existing publication counter. Visible publication
numbers SHALL be stable and increase within the article language; deletion or pruning SHALL NOT reuse numbers. Unsaved edits
SHALL remain distinguishable from saved versions.

#### Scenario: Saving and publishing one edit

- **WHEN** an editor saves changed text, author or other captured inputs
- **THEN** one new saved version is recorded
- **AND** repeating an unchanged save or retrying the same request creates no additional version
- **AND** publishing that state preserves its snapshot identity and assigns the next publication number
- **AND** changing only an account's current name does not create a content version

#### Scenario: Saving after a historical return

- **WHEN** v40 was the latest allocated publication and an earlier publication is resumed or a retained state is removed
- **THEN** subsequent changed saves remain labeled Draft and the next new publication is v41
- **AND** deleting a draft or republishing an unchanged existing publication does not consume or reset publication numbers
- **AND** optimistic concurrency versions and internal snapshot allocations remain independent of visible publication numbers

#### Scenario: Saving resumed content without another edit

- **WHEN** staff resume a publication whose captured inputs differ from the current working state and save it without further edits
- **THEN** a distinct current draft is saved even though its inputs match the historical source
- **AND** the source publication retains its original identity and content
- **AND** publishing preserves the new draft identity rather than moving the source publication into the live position

### Requirement: Authorized blog history management

Active staff SHALL be able to inspect history. Only the current designated author
or an administrator SHALL resume historical states for republication or delete
history. Authorization SHALL use the current article before restoration, not the
selected historical author. Ordinary collaborative draft editing and explicit
author reassignment SHALL retain their existing policy.

#### Scenario: A historical author attempts to take control

- **WHEN** a caller owns the selected old signature but lacks current management rights
- **THEN** direct historical resumption and deletion requests are rejected
- **AND** selecting the old version does not change ownership

#### Scenario: Managing a signature and deleting a version

- **WHEN** the current author or an administrator resumes a state
- **THEN** the resumed draft retains its designated author and the existing author selector remains available
- **AND** an explicit saved reassignment changes current management rights under the existing article-wide authorship policy
- **AND** other languages' saved signatures and live publications remain unchanged
- **WHEN** an authorized user confirms deletion of a non-live retained version
- **THEN** only that version is removed, without renumbering or changing live content
- **AND** the live publication cannot be individually deleted from history
- **AND** deleting the sole saved draft returns to the live state, or an empty unsaved state if nothing is live, without resetting allocation counters or creating another saved draft

### Requirement: Blog history inspection and comparison

The editor SHALL offer a right-side history panel with publication numbers, a translated unnumbered draft, authors,
times, states and separate publication/draft counts in one chronological list
without reprise lanes. Selection SHALL show a
read-only state. A unified diff against the live language publication SHALL show
unchanged context once and emphasize changed words within subtle removed and
added rows. Comparison work SHALL be bounded, falling back to complete removed
and added text for expensive inputs. Missing live content SHALL have an explicit
comparison empty state.

#### Scenario: Comparing a small text change

- **WHEN** only one word changes inside a paragraph
- **THEN** unchanged words retain subdued emphasis and the changed words have stronger removed/added backgrounds
- **AND** a pure insertion does not invent a removal or duplicate an unchanged prefix
- **AND** changed captured fields are distinguishable without relying only on color
- **AND** Markdown and diff text cannot execute supplied markup or scripts

#### Scenario: Switching reading and comparison

- **WHEN** staff inspect a saved state or compare their current draft
- **THEN** Read and Compare are both available as explicit selected modes
- **AND** comparison names both endpoints, such as v22 (live) to Draft, including the translated unsaved-draft distinction
- **AND** the reference endpoint uses the same red semantic treatment and minus marker as removed values, while the selected endpoint uses the green treatment and plus marker of added values
- **AND** switching to Read and back to Compare preserves the selection and working content
- **AND** title, slug, summary, author, categories and image differences remain included, with an explanation that unchanged fields are hidden

#### Scenario: Inspecting on a narrow screen

- **WHEN** a user opens history on mobile or uses the keyboard in either theme
- **THEN** selection, comparison, version labels and permitted actions remain usable without horizontal overflow
- **AND** leaving dirty work requests an explicit save or discard decision
- **AND** historical inspection does not mutate article content, attribution or permissions

#### Scenario: Comparing a working draft and captured fields

- **WHEN** staff compare the current draft, including unsaved edits, or a selected history version
- **THEN** the reference remains the live publication in the selected language
- **AND** the existing paragraph/word diff, whitespace handling and bounded fallback remain available
- **AND** comparison covers title, slug, summary, signature, thumbnail, banner, their alternative text, categories and Markdown
- **AND** changed metadata uses separate removed/added rows with the same semantic colors as Markdown changes, minus/plus markers and accessible removed/added descriptions
- **AND** each displayed field and the Markdown block has a visible label identifying what is compared, with the Markdown heading also naming its accessible section
- **AND** before/after images, loading and retry feedback, read previews and return to draft remain available
- **AND** comparison does not overwrite or save the working draft

### Requirement: Private and compatible blog history adoption

History and history-only images SHALL require fresh article read permission.
Public responses SHALL expose only effective live content. Article lists SHALL
exclude history bodies; history lists SHALL return bounded summaries and fetch
selected bodies on demand. Retry acknowledgements SHALL remain small.
`BlogsClient.history` SHALL be optional. Hosts SHALL own validated transport,
session checks, cache invalidation and coordinated migration.

#### Scenario: Requesting archived content publicly

- **WHEN** an unauthenticated visitor requests a historical body, its metadata or a history-only image
- **THEN** it is not disclosed through public endpoints or caches
- **AND** an authorized staff reader can inspect it without making it public

#### Scenario: Adopting existing articles

- **WHEN** a host explicitly migrates existing blog data for history support
- **THEN** it generates additive migrations from the exported Drizzle schema and stops incompatible writers
- **AND** `backfillHistory` followed by `backfillBlogProjections` runs in the reviewed migration transaction
- **AND** current drafts and live publications become retained initial states without invented older versions
- **AND** content, saved signatures, image IDs, URLs and publication metadata are preserved
- **AND** repeating migration creates no duplicate versions
- **AND** identical current draft/publication inputs share one initial history identity
- **AND** existing clients remain usable for ordinary publication without history controls, while the server rejects direct activation of a historical publication
- **AND** history-enabled hosts wire authorized `list`, `get`, `plan`, `publish` and `delete` operations while preserving their adapters
- **AND** migration-journal and Blogs readiness checks pass before traffic is served
- **AND** source installation runs no migration and does not establish deployment

#### Scenario: Rolling back history controls

- **WHEN** a host rolls back the history interface
- **THEN** it retains the additive schema, history data and compatible writers
- **AND** it does not downgrade to writers that discard localized settings or history counters

#### Scenario: Installing the simplified workflow

- **WHEN** a host installs source for the simplified history workflow
- **THEN** installation does not run a data migration, remove deployed records or alter objects
- **AND** existing schema, authorized transport and startup-readiness requirements still apply

### Requirement: Independent blog history limits

Each article language SHALL retain at most five publications, including its live
publication, and one saved draft. Changed saves SHALL replace the previous draft.
Successful publication SHALL promote the current saved draft without duplication
and clear the pending draft. Only exceeding the publication limit SHALL prune the
oldest publication. Unpublishing SHALL preserve retained history without allocating
a content version. Languages SHALL retain independent limits.

#### Scenario: Saving a ninth draft

- **WHEN** staff continue editing and perform a ninth changed save in the selected language
- **THEN** only the latest saved draft remains, without a replacement warning for ordinary continuation
- **AND** publications are preserved and unchanged saves or retries create no duplicate entry

#### Scenario: Publishing a sixth publication

- **WHEN** publishing the current saved draft would retain six publications
- **THEN** publishing automatically removes the oldest publication without a retention confirmation
- **AND** success leaves five publications, makes the promoted draft live and removes its separate draft entry
- **AND** a stale request or failure preserves the previous live state, draft and publications

#### Scenario: A history contains fewer than six entries

- **WHEN** a language has fewer than five publications or no pending saved draft
- **THEN** only existing states appear, without placeholder versions or duplicate live/draft entries
- **AND** another language's states and limits remain unchanged

### Requirement: Confirmed atomic blog history publication

Publication SHALL atomically publish the current saved draft, preserve its identity
and retain publications subject only to the five-publication limit. Historical
content SHALL first be resumed into the draft. Publication-limit pruning SHALL
be automatic, including for clients without history controls. Explicit deletion,
draft replacement and missing-image omission SHALL retain their confirmations.
Server-derived plans SHALL remain version-bound. Authorization, validation, concurrency,
image recovery and idempotency SHALL remain enforced.

#### Scenario: Reworking v18 before publication

- **WHEN** an authorized user resumes v18 while v22, v26, v36 and live v37 are retained
- **THEN** the resumed content becomes the working draft while v37 stays live
- **AND** saving preserves all five publications and replaces only the previous draft after the required confirmation
- **WHEN** the user publishes the saved draft
- **THEN** it becomes a new live publication and v18 is removed only because it is the oldest of six publications
- **AND** v22, v26, v36 and v37 remain retained, with no additional deletion caused by the source's age

#### Scenario: A stale or failed confirmation

- **WHEN** article state changes after a missing-image plan was displayed, or authorization, validation, image checking or persistence fails
- **THEN** the prior live content, saved draft and retained history remain intact
- **AND** the UI preserves selected content and unsaved input for correction or retry
- **AND** a stale article version or plan token returns `CONFLICT` and requires a fresh plan and confirmation
- **AND** replaying a successful request does not repeat deletion or allocate another version

#### Scenario: A historical publication is submitted directly

- **WHEN** a caller attempts to activate a historical publication in place without first saving it as the current draft
- **THEN** the request is rejected without changing live content or retained states
- **AND** editor, table and transport entrypoints cannot bypass the draft-first workflow

## ADDED Requirements

### Requirement: Confirmed single blog draft resumption

Resuming a retained publication SHALL prepare its complete content in the single
draft without changing live content. Replacing an existing draft SHALL require
explicit confirmation naming the loss. Cancellation SHALL preserve the draft.
Reading history SHALL remain read-only. Unsaved-change, failure and concurrency
protections SHALL continue to apply.

#### Scenario: Continuing the current draft

- **WHEN** v3 is live and staff continue editing and saving the draft derived from v3
- **THEN** the latest saved content replaces that draft without a replacement warning
- **AND** v3 remains live until publication succeeds

#### Scenario: Resuming v1 while a draft from v3 exists

- **WHEN** v3 is live, a draft derived from v3 exists, and staff only inspect v1
- **THEN** no draft is replaced and the existing unsaved-change guard still protects departure from dirty work
- **WHEN** staff choose to resume v1
- **THEN** confirmation states that the current draft and its changes will be replaced
- **AND** cancel retains the current saved and unsaved work
- **AND** confirming prepares v1 as the sole working draft while v3 stays live
- **AND** the prior saved draft is replaced atomically only when the resumed content is successfully saved
- **AND** failed saves retain the prior saved draft and the resumed local input for retry

#### Scenario: Resuming with no pending draft

- **WHEN** v3 is live and staff resume either v2 or v1 with no pending draft or unsaved work
- **THEN** the selected version becomes the working draft without a false loss warning
- **AND** v3 is not moved into the draft and publications remain unchanged until Publish succeeds
- **AND** republication requires a distinct saved draft, even when the source content was not edited

#### Scenario: Another editor changes the draft after confirmation

- **WHEN** another editor saves after replacement was confirmed but before the resumed draft is saved
- **THEN** the stale save returns `CONFLICT` without overwriting that newer draft
- **AND** staff must review the refreshed state and reconfirm replacement before retrying historical resumption

### Requirement: Simplified blog history showroom

The Blogs showroom SHALL demonstrate the one-draft, five-publication workflow with
localized examples and controls matching the shipped model. Existing permission,
transport, concurrency, missing-image and failure simulations SHALL remain usable.
It SHALL demonstrate the actual comparator rather than the mockup's simplified
text display.

#### Scenario: Loading the history example

- **WHEN** a reviewer loads the history example for the open article
- **THEN** English and French each receive five publications and one draft with their own content
- **AND** the live publication counts among the five and no parallel reprise branches appear
- **AND** unrelated articles remain unchanged and no obsolete eight-draft or multi-reprise help remains

#### Scenario: Exercising replacement and preserved controls

- **WHEN** a reviewer resumes an older version while the example has a draft
- **THEN** confirmation supports cancellation and successful continuation
- **AND** repeated ordinary draft saves do not request replacement confirmation
- **AND** History transport, concurrent-correction, missing-illustration, permission and failure controls continue to exercise their intended behavior
- **AND** detailed comparison remains available for selected versions and unsaved draft content
- **AND** settings retain their existing responsive visibility, keyboard behavior and values when collapsed

#### Scenario: Choosing the Blogs interface language

- **WHEN** a reviewer opens Blogs in French, German or Italian
- **THEN** the showroom supplies complete translated plugin labels for fields, statuses, history, actions, errors, confirmations and the image-crop dialog
- **AND** English continues to use the plugin’s default labels
- **AND** admin navigation retains the interface locale even when the article’s selected translation is English or French
- **AND** changing the interface language does not create, publish or silently translate article content

## REMOVED Requirements

### Requirement: Independent blog reprises

**Reason**: One latest draft per article language replaces independent saved reprise branches.
**Migration**: Resume a publication into the single draft with replacement confirmation. The owner confirmed no existing history data requires migration for this change.

### Requirement: Simultaneous blog reprise paths

**Reason**: The simplified workflow no longer retains parallel reprise branches.
**Migration**: Show chronological publications and the optional single draft, preserving read, compare, resume and authorized deletion actions.
