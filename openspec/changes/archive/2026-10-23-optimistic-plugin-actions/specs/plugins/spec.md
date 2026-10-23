## ADDED Requirements

### Requirement: Optimistic plugin actions

Predictable data mutations in Employees, Customers, Projects, Blogs, Drive, Menus
and Reservations SHALL update visible records, statuses, ordering or lists before
the response using TanStack Query. Rejection SHALL remove only the temporary
change, retain current host data and show a translated error. Forms SHALL retain
drafts and destructive confirmations SHALL retain recovery controls.

#### Scenario: A mutation is rejected

- **WHEN** a user confirms deletion, changes a record or reorders items
- **THEN** the view updates before the request completes
- **AND** rejection restores the prior view without overwriting unrelated host updates
- **AND** error feedback and retry controls remain available

#### Scenario: A save succeeds

- **WHEN** the server returns a saved record or the host refreshes data
- **THEN** the UI reconciles canonical IDs, versions, ordering and permissions
- **AND** temporary records are removed and success feedback follows confirmation

### Requirement: Optimistic mutation isolation

Hosts SHALL retain transport, authorization, cache keys and route ownership.
Existing callbacks and clients SHALL remain compatible. Standalone plugin
instances SHALL work without a mandatory provider or shared server-process
Query state. Pending mutations SHALL prevent duplicate submissions and mutations
against temporary records. UI mutations SHALL NOT retry automatically, queue
for reconnect or persist callbacks or private records to browser storage.

#### Scenario: Changing scope during a request

- **WHEN** a user changes resource, account or filtered page during a mutation
- **THEN** temporary data is not applied to another scope
- **AND** optimistic state grants no access to protected data

#### Scenario: Installing updated source

- **WHEN** a consumer installs an updated plugin
- **THEN** its declared dependencies include the optimistic mutation utility
- **AND** existing data callbacks remain usable without adopting showroom infrastructure

### Requirement: Server-confirmed operation results

Authentication, impersonation, file transfer, email delivery, management-link
revocation and new booking receipts SHALL retain server-confirmed completion.
Navigation needing a server-issued ID SHALL wait for it. Success toasts SHALL
follow the server response. Rescheduling MAY preview returned availability-slot
endpoints while retaining server capacity checks and final resource assignment.

#### Scenario: A reservation move fails

- **WHEN** the selected slot becomes unavailable before the server saves it
- **THEN** the preview reverts to the existing reservation
- **AND** the form retains the requested values and displays the failure

## MODIFIED Requirements

### Requirement: Menu item drag feedback

Dragging a menu item SHALL preview its name, category and insertion edge while
retaining the saved row order. Dropping SHALL immediately apply the previewed
order, save it and revert on rejection. Canceling a drag SHALL clear its feedback
without saving. Keyboard reordering, search and pending controls SHALL remain
available. Feedback SHALL support mouse, touch, both themes and narrow screens.

#### Scenario: Previewing an insertion

- **WHEN** staff drag an item over the top or bottom half of another row
- **THEN** a floating item preview, distinguished source row and insertion line show the proposed move
- **AND** the preview does not intercept pointer hit testing or add duplicate accessible controls
- **AND** dropping immediately moves the item to that position without changing its category
- **AND** rejection restores the saved order and displays the error

#### Scenario: Canceling a previewed move

- **WHEN** staff press Escape, the pointer is canceled, or they drop on the source or outside the table
- **THEN** the drag preview and insertion line disappear
- **AND** no reorder is saved and the original row order remains
