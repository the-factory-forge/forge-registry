# Registry context

Forge provides reusable website features and a showroom where their behavior can
be explored. This language describes the content and staff workflows those features share.

## Language

### Connectors

**Connector**:
An optional relationship that lets a Forge plugin work with another plugin,
library or external service, with behavior specific to that pair.
_Avoid_: Universal sync engine

**Adapter**:
The implementation that connects a connector's required interface to a provider
or host website.

### Blogs

**Blog editor**:
The staff workspace for preparing article translations and managing blog categories.

**Blog draft**:
The single saved, editable version of one article translation. Each save replaces
its previous draft; readers keep seeing the current publication until publication.
_Avoid_: Publication, live article

**Unsaved blog changes**:
Edits in the blog editor that have not yet been saved into the article's draft.
_Avoid_: Saved draft

**Blog publication**:
A saved snapshot of an article translation released for public reading. The current
publication is the snapshot readers see, while earlier publications may remain in history.
_Avoid_: Live draft

### Drive

**Drive listing**:
One page of spaces, folder contents, trashed entries or possible restore destinations
for a particular location, search and ordering.

**Drive recovery**:
The process of undoing a move to trash or restoring a trashed entry, including
resolving name or destination conflicts and retrying failed attempts.
_Avoid_: Permanent deletion

### Menus

**Menu editor**:
The staff workspace for editing menu items, categories and labels.

**Menu item**:
A dish or drink with translated content, prices, a category and optional labels,
with its own visibility, availability and position in the menu.

**Menu taxonomy**:
The categories that organize dishes and the reusable allergen and dietary labels
assigned to them, with names for each supported language.

### Reservations

**Reservation**:
An appointment or stay for a customer, associated with a service, an assigned
resource, a time period and a reservation policy.

**Reservation status**:
The booking's approval or cancellation state: Pending, Confirmed, Rejected or
Cancelled. Pending means awaiting approval, including when rescheduling requires renewed approval.
_Avoid_: Request progress, save status

**Reservation rescheduling**:
A change to the dates, times or assigned resource of an existing reservation.
_Avoid_: New reservation

**Reservation cancellation**:
The ending of an existing booking, whose record remains with the Cancelled status.
_Avoid_: Closing a dialog, discarding a rescheduling draft, ignoring a late response

### Deletion

**Deletion session**:
One or more selected records awaiting deletion confirmation, being deleted, or
awaiting retry after a failed attempt.

**Deletion confirmation**:
The user's approval to submit deletion of the selected records.
_Avoid_: Deletion success, completed deletion
