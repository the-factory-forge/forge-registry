# Forge plugins

A Forge plugin is an optional application feature installed as editable source
through `@forge`. It groups related pages/components, types, labels and host
integration contracts. Shared UI is a starting skeleton for website generation.
Site-specific fields and workflows belong in the consuming website. Project
forms, for example, edit only name, status and description; host adapters own
ownership and assignment.

A service plugin provides a shared application capability without its own screen.
Mailing supplies transactional email rendering and a separate server transport
for plugins that need to send messages.

A server companion implements persistence or server operations for the same
feature. Hosts own routing, authorization, data, branding,
translations and transport; installation does not enable routes or apply migrations.

The registry-owned [Plugins specification](../openspec/specs/plugins/spec.md)
defines each feature and its boundaries. The [registry manifest](../registry/registry.json)
is authoritative for files and dependencies.

Auth reset and change forms take one new password without confirmation. Signed-in
changes in account security also require the current password; hosts validate it
and the session on the server. Sign-in links to email recovery. See the
[password integration guide](./intranet-auth.md#password-recovery-and-changes).

Auth account pages also support host-supplied plugin tabs and optional confirmed
email changes. About and plugin panels preserve form state across tab switches;
see [account sections and email](./intranet-auth.md#account-sections-and-email).

Auth agent keys use the shared [deletion session](./table-selection.md) for row selection, select-all with a mixed state, and confirmed
bulk deletion through the existing host callback. Failed keys remain available for
retry; see [account security](./intranet-auth.md#account-profile-and-security).

| Plugin         | Purpose                                                                                                                                                                | Optional server item      | Guide                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| `auth`         | Sign-in/out, account profile/security, recovery, password changes and access-denied UI                                                                                 | Host auth provider        | [Auth](./intranet-auth.md)                  |
| `employees`    | Admin-only employee accounts, editing, verification and host-supplied website visibility                                                                               | `employees-server`        | [Employees](./intranet-auth.md#employee-ui) |
| `customers`    | Customer contact/company records, editable verification badges and composition of Projects/Sync                                                                        | `customers-storage`       | [Customers](./customers.md)                 |
| `projects`     | Basic project forms, editable status badges, host-owned customer relationships and Details/Drive views                                                                 | `projects-storage`        | [Projects](./projects.md)                   |
| `drive`        | Scoped file browser, folder action menus, file/directory uploads, duplication and opt-in trash/restoration                                                             | `drive-storage`           | [Drive](./drive.md)                         |
| `blogs`        | Multilingual Markdown articles with one draft and five publications per language in PostgreSQL, private S3 illustrations, cropped covers, categories and public search | `blogs-storage`           | [Blogs](./blogs.md)                         |
| `menus`        | Restaurant menus, draggable order with previews, sizes, translations, images, editable label icons, spice levels and A4/A5 printing                                    | `menus-storage`           | [Menus](./menus.md)                         |
| `mailing`      | Branded HTML and plain-text transactional emails for other plugins                                                                                                     | Server transport included | [Mailing](./mailing.md)                     |
| `reservations` | Appointments or overnight stays, policies, calendars and dedicated staff creation                                                                                      | `reservations-storage`    | [Reservations](./reservations.md)           |

Drive folder menus support child-folder creation and ZIP downloads alongside
uploads, rename, duplication and trash. ZIPs use the existing authenticated reads
with the browser size limits described in the [Drive guide](./drive.md#folder-action-menu).
The named space root exposes uploads, folder creation, whole-space ZIP download
and host-authorized rename through the same three-dot menu.
The current breadcrumb title supports direct inline renaming with Enter or blur
to save and Escape to cancel, using the existing permissions and host callback.

Drive uses the shared [subpage sidebar](./subpage-sidebar.md) for the named space root, an
expandable folder tree and optional Trash. The tree uses the existing scoped
client reads; navigation does not grant access or change storage semantics.

Storage companions rebuild `[asset_name]-[type]-[modifier].[extension]` object
filenames under their existing UUID directories and site/plugin prefixes. Hyphens
separate fields; underscores join words within a field. Blogs replaces the type
with `blog`; Drive uses its scope type, normalized to `menu_item` for Menus media.
Employees uses `employee` and retains the source asset name through cropping and
the host upload callback. Host-managed image uploads follow this same convention;
their server adapters validate bytes before choosing the extension.
Existing modifiers are retained, except `original`; absent modifiers stay absent. See
[Drive migration and naming](./drive.md#object-filenames) and
[Blog naming](./blogs.md#object-filenames) before adopting the server companions.

Blogs separates authors from editors, supplies staff collaboration permissions,
requires review of legacy attribution and crops covers by default. Current account
bylines and retained signatures use host name/deletion adapters; see
[authors and collaboration](./blogs.md#authors-collaboration-and-account-changes).

The Blog editor and Menu editor are separate domain modules, each owning its forms,
save flow and unsaved-change protection. Their existing page interfaces stay stable.
The Blog editor also owns asynchronous completion: replaced clients or departed
editors cannot accept late results, feedback or host callbacks. Client replacement
preserves unsaved inputs while invalidating old operations and confirmations; see
[Blog editor adoption](./blogs.md#updating-consumers).
Blog category and menu taxonomy editors expose the same optional router guard as
their content editors. Hosts can offer Save, Discard and Cancel for browser
Back/Forward while protecting pending saves; see the [Blogs](./blogs.md#history-interface)
and [Menus](./menus.md) integration guides.

## Service input validation

Menus, Drive and Blogs parse service request inputs with Zod before using their
fields or writing data. Malformed inputs return the existing plugin `INVALID`
error. Schemas strip unknown object fields; Menu item payloads cannot override
record IDs or versions. Optional Menu sizes, spice levels and label icons retain
their existing omission semantics. Drive host listing cursors remain opaque.
Blog drafts may remain incomplete until publication.

Authorization, relationships, stale-version checks, idempotency, image inspection,
and storage limits remain service business rules. Host adapters still own session
and transport protection. Install each updated companion with its dependencies;
no database migration is needed for this validation change.

Recorded consumers requiring separate adoption review are Terminal60 (Menus/Drive),
Sinigest (Drive), L’Aspic and Osthoepathie Seebach (Blogs), plus custom TC integrations.
The template does not install these optional plugins by default. Installed consumer
source and deployments were not updated by this change; other installations remain
uninspected.

## Storage encryption and access

For Infomaniak storage, rely on its built-in encryption for all stored files,
including public assets. Infomaniak documents automatic AES-256 encryption in
[section 8.4 of its Public Cloud terms](https://welcome.infomaniak.com/api/components/cgu/latest?id=70&locale=en_GB)
and its [Swiss Backup documentation](https://news.infomaniak.com/en/swiss-backup-en/).
No application encryption key or AWS-specific encryption header is required for
this provider-managed protection. It does not prevent an authorized storage
reader from retrieving plaintext; object names should not contain sensitive details.

Keep application buckets and objects private. Drive checks the host's current
scope and download permission before issuing a five-minute signed URL; anyone
holding that URL can use it until expiry, including after their permission is
revoked. Employee and customer scope rules remain the host's responsibility.
Never expose `readTrustedFile` as a browser-callable download operation.

Blog image routes must call `readImage` and preserve its `no-store` response policy.
Anonymous reads require the image in a current published snapshot of its owning
article. New draft replacements and unused uploads stay private; unpublishing
all referencing translations or deleting the article removes anonymous access.
Publication never changes the underlying object's ACL. Separate public features,
such as visible Menu images and explicitly public team/portfolio images, must
authorize their own exact references and the owning record's current visibility.

Check the deployed container/object ACLs and unsigned GET/HEAD requests separately
from application tests. Infomaniak's [ACL documentation](https://docs.infomaniak.cloud/object_storage/acls/)
notes that `s3.pub1` does not support S3 bucket policies; site/plugin prefixes do
not provide access control. The companions' `verifyBucket` checks versioning,
not public ACLs or provider encryption. Local MinIO tests prove application access
behavior, not the live Infomaniak configuration or coverage of older objects.

Employee photos are optional and use the shared crop dialog. Deletion can review
linked records from multiple host adapters and commit their decisions atomically;
see [employee photos and related data](./employees.md).

## Shared loading feedback

All UI plugins declare [`@forge/loading-indicator`](./loading-indicator.md). Their
read/refresh states feed one host-owned indicator beneath the navbar, with a 300ms
hold after all loading completes. Existing errors, local feedback and disabled
states remain intact. Install the new dependency and place its provider and
indicator once in the host shell when adopting the source.

## Shared presentation

Plugins follow the [Shared UI contract](https://github.com/the-factory-forge/forge-specs/blob/main/openspec/specs/shared-ui/spec.md).
Every password field includes a trailing Show/Hide eye button with translated
accessible names and icon tooltips. Auth, employee creation and customer creation
share this behavior without changing their password values or submission rules.
Primary detail statuses sit at the top right, opposite the title; table statuses
stay in their columns. Enabled controls ship pointer cursors, disabled controls
retain disabled behavior, and adjacent actions keep visible gaps. Refresh,
settings, create, edit and delete use the shared Lucide conventions. Refresh/reload
controls show only the refresh icon, retaining their translated accessible name and tooltip. Icon-only
buttons and action links use [`@forge/icon-tooltip`](./icon-tooltip.md) with their
translated accessible names, including edit/delete and close controls. Existing
confirmations, disabled states and visible action labels remain in place.
Every dialog has a top-right X control, with a translated accessible name and
tooltip. It follows the existing dismissal and pending rules, with space for long
titles on mobile. New close labels can be translated through the existing labels
props; Reservations passes its existing `close` label through every modal.
Single-input create/edit dialogs focus their editable field when opened, including
on touch devices. Drive applies this to folder creation, rename and duplication;
confirmation dialogs retain their existing focus behavior.
Modal titles and close controls stay pinned at the top, and bottom actions stay
pinned at the bottom while long content scrolls. Both regions use the dialog
surface color so fields cannot show through them; actions wrap on narrow screens.
Keep footer positioning relative to the whole dialog: modal forms and conditional
result wrappers use `contents` so their boxes cannot trap sticky actions below
the viewport. Preserve the form element, submission handling and field spacing.

Customer, Project, Employee, Blog, Menu and Drive tables share header styling
and right-aligned row actions with 8px gaps. Action buttons stay on one line;
action headers and cells stay pinned to the right edge at every viewport width,
including mobile, while the other columns scroll beneath their themed surface.
Auth agent-key tables use the same pinned action header and cell styles. Keep row-specific unavailable actions visible and
disabled in their usual positions; follow [table action alignment](../DESIGN.md#table-action-alignment).
Employees always shows verification/invitation, edit and delete in that order:
verified accounts disable verification, and the current user disables delete.
Pending invitations retain their resend action even when email is verified. Menus exposes `labels.actions` for its action
column heading. The reservation year grid shares table typography and header
spacing while retaining its date cells, sticky month labels and keyboard navigation.

Paginated plugin tables share [`@forge/table-pagination`](./table-pagination.md).
Blogs and Employees supply totals and page numbers. Drive shows the current page
and uses Previous/Next with cursor history, without inventing totals. Customers,
Projects and Menus render their supplied lists without pagination. Reservations
uses numbered pages in List and date navigation in its calendar views. Labels and data callbacks stay host-owned.

Table headers and their surrounding panels stay visible during loading, empty
results and errors. Feedback belongs in a spanning table row; background loading
retains supplied rows, announces progress and disables mutations and pagination.
Hosts using controlled lists must keep their last loaded rows while fetching.
Drive also retains its table listings and folder-tree pages after read failures,
with mutations and pagination disabled until recovery; denied or missing listings
clear their rows. Tree cursor pages accumulate folders; table reads replace pages.
See the [Drive guide](./drive.md) for cancellation and authenticated-session resets.
Employee tables still render nothing without an authenticated admin role.

Customer verification and project lifecycle badges open an accessible status menu
when the host supplies the corresponding mutation callback. Project details can
also use their existing save callback. Other statuses remain informational.

Single-choice form dropdowns share `@forge/native-select`, which keeps a 12px chevron inset
and reserves space between the selected text and arrow. Its native control preserves
keyboard selection, labels, validation and disabled states. The dependency ships
with affected plugins; see the [native select guide](./native-select.md).

Create/edit modal forms support Cmd+Enter on macOS and Ctrl+Enter on Windows/Linux.
The shortcut activates the existing submit button, preserving validation, disabled
states and failure handling. It stays inside the active dialog and does not add
a shortcut to destructive confirmations or standalone page forms. The
`@forge/dialog-submit` utility ships with Drive, Employees, Menus and Reservations;
their existing showroom examples demonstrate it.

Default action and field labels use sentence case, such as **Create** and
**Save changes**. Primary actions omit the resource already named by their
section: **Invite** in Employees and **Create** in resource lists. Keep the
object when it distinguishes actions, such as **New folder** beside file uploads.
Form headings and destructive confirmations remain descriptive. Translate
`createAction` for Blogs, Menus and Reservations, and `addTitle` for the employee
invitation dialog, alongside existing label overrides. Employee account actions
use **employee** consistently.
Success messages name the completed action without an added “successfully”.
Brief save, update and action confirmations use fixed, dismissible
[`@forge/action-toast`](./action-toast.md) notifications. Validation errors and
persistent instructions remain beside their controls. Plugin entrypoints provide
a queue automatically; a host-level provider preserves it across navigation.
Drive uploads, downloads and recovery actions use the same renderer and queue.
All toasts stack at the bottom right, use semantic loading/result icons, and put
optional status/details left and actions right in the footer. Reuse the shared
provider and footer for new toast content; do not add another toast layout.
Hosts can still override labels through the existing props.

Administrative form fields and text buttons use a 40px minimum height with lg
corners. Existing icon actions retain their compact hit areas. Customer, project,
blog and Drive panels follow the table panels' xl corners and 24px padding.
Authentication and public signup forms retain larger controls for their context.
These styles ship in each item's existing files and require no new dependency.

Hosts must supply all semantic status background/foreground pairs and Tailwind
mappings described in [Design tokens](../CONTRIBUTING.md#design-tokens), including
`status-success`, `status-pending`, `status-not-started`, `status-canceled` and
`status-info`. The showroom's stylesheet is not installed with a plugin.

| Plugin state                                                   | Semantic status                                 |
| -------------------------------------------------------------- | ----------------------------------------------- |
| Project requested / prospect / under construction / production | Not started / informational / pending / success |
| Customer or employee verified / unverified                     | Success / pending                               |
| Employee active                                                | Success                                         |
| Employee visible / hidden on website                           | Success / not started                           |
| Employee or customer disabled                                  | Canceled                                        |
| Blog published / unpublished changes / draft                   | Success / pending / not started                 |
| Menu visible / hidden, available / sold out                    | Success / not started, success / pending        |
| Reservation confirmed / pending / rejected or cancelled        | Success / pending / canceled                    |

Errors retain destructive tokens. Status badges keep readable translated text,
so meaning does not depend on color. Theme values remain host-owned.

Standalone item editors (Blogs, Menus, Customers and Projects) share
`@forge/editor-form`. Save/publish actions stick to the bottom of the viewport
within their form, wrap on narrow screens and respect the device safe area.
Submission scrolls and focuses the first invalid field, with destructive styling
and an associated inline message. Editing clears that field’s message; the next
submission checks the remaining fields. Translation errors reveal the applicable
language. Client feedback supplements existing server validation and keeps drafts.
Blog publication requirements appear only beside fields after a publish attempt;
incomplete drafts remain saveable. Hosts can reuse the helper for their own editors.

## Table selection and bulk deletion

Auth keys, Customers, Projects (including embedded lists), Employees, Blogs, Menu items,
and Drive file/trash tables use [`@forge/table-selection`](./table-selection.md).
Select individual rows or all eligible rows on the current filtered page. The
header checkbox shows a mixed state for partial selection. The trash action stays
visible, disabled with neutral pagination colors until rows are selected.
Confirmation lists the selected names; failed
rows remain available for retry without repeating successful deletions.

Existing host authorization and deletion restrictions still apply. Employees
exclude the current user, Menu items with linked files cannot be deleted, and
Drive obtains server previews and tokens before confirmation. Drive preserves
trash, permanent-delete and Undo behavior. Spaces and calendar date grids have
no row deletion and do not offer bulk selection.

Install the shared helper with each affected plugin and translate its added
labels through the existing plugin labels prop. No new batch server API is
required: deletion invokes the existing callback once per selected row.
The helper owns confirmation, pending state and retries. Scope changes cancel
unconfirmed previews; confirmed batches may finish across host refreshes, while
unmounting the control stops later requests. Employee retention deletion remains
a separate transaction-backed flow. See the [source adoption handoff](./HANDOFF-bulk-deletion-session.md)
before updating custom helper callers or installing Auth's new dependency closure.

## Optimistic actions

Customers and Projects share list/form-owned single-record confirmations through
`@forge/record-deletion`. See [their deletion lifecycle](./optimistic-actions.md#customers-and-projects-deletion)
for view changes, host refreshes, retry and focus recovery.

Plugins use TanStack Query mutations through [`@forge/optimistic-action`](./optimistic-actions.md).
Predictable changes appear before the request completes and revert on rejection.
Ordinary completion is scoped to the submitting client/resource and mounted view.
Reservations explicit Refresh restarts selection and rescheduling; Drive recovery
and confirmed deletion keep their documented lifetimes.
Forms retain drafts, confirmations retain recovery controls, and success toasts wait
for server confirmation. Hosts keep their existing data and transport callbacks. Bulk deletion keeps its
confirmation open while existing callbacks settle, removes each confirmed
success from selection and retains failed entries for retry.

## Updates

Install only the required items, keep adapters outside managed files, and review
the generated source diff. A companion may install its parent's UI and declared
feature dependencies; it still needs explicit server setup. Each guide describes
those dependencies and any migrations. Validate the host's themes, permissions,
locale routing and workflows before deploying an updated consumer.

## Persistence ownership

Persistent companions use typed Drizzle queries and server-only schema exports.
Each host composes authentication and installed plugins into one schema and owns
its migration history. Customers and Projects now offer `customers-storage` and
`projects-storage`; Mailing remains stateless. Read [plugin persistence](./persistence.md)
for schema composition, migration generation/review, backfills and cutover.
