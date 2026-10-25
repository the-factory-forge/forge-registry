# Reservations

`@forge/reservations` provides guest appointment and overnight stay booking, private booking management,
staff year/month/week/day/agenda calendars, and settings editors. `@forge/reservations-storage`
adds a PostgreSQL service, Drizzle tables, signed management
links, and a durable email queue. Both distribute editable source.

```sh
pnpm dlx shadcn@4.22.1 add @forge/reservations-storage
```

When updating several plugins, install Reservations storage last. shadcn 4.22.1
still has the [combined-install limitation](releases/v0.0.0-rc.2.md#validation):
it can rewrite the `renderEmail` import to another plugin. Running the command
above separately with `--yes --overwrite` restores the Mailing import; inspect
the diff and run the host type check after installation.

Import browser components and types from `@/components/plugins/reservations`. Import
`createReservationsService`, `deriveManagementSecret` and schema tables only from
`@/components/plugins/reservations/server`.
The browser entrypoint never imports or exports the server companion. No framework,
email provider, customer account system, Drive storage or Better Auth schema plugin
is required by the item. Existing host authentication supplies staff authorization.

## Set up the host

1. Include the companion's exported Drizzle tables and `pluginLocks` in the host
   schema. Generate, review and apply its migration following the
   [persistence guide](./persistence.md).
2. Supply a typed Drizzle PostgreSQL database with query builders and `transaction`, using
   the default Read Committed transaction isolation. Use a separate database per
   business, as in Forge's existing deployment convention.
3. Derive the management signing key from an existing server-only host secret with
   `deriveManagementSecret`. Use a cryptographically random root secret of at least
   32 bytes, such as the host's existing `BETTER_AUTH_SECRET`; no separate reservation
   environment variable is needed. Configure a canonical management URL, a fresh-session
   authorization callback, and an email provider callback. Keep these adapters outside
   registry-managed files.
4. Expose explicitly selected service methods through host routes or server functions.
   Validate HTTP shapes, impose body limits, apply CSRF/origin protection to mutations,
   and rate-limit public booking, availability and management requests. Anonymous
   booking is intentionally available; production hosts must configure abuse limits.
5. Deliver queued notifications after successful mutations and run
   `deliverNotifications()` from a trusted host scheduler, for example every minute.
   Do not expose the worker itself as an anonymous endpoint. Give the email adapter
   a network timeout below the five-minute delivery lease.

```ts
import {
  createReservationsService,
  deriveManagementSecret,
} from "@/components/plugins/reservations/server";

const managementSecret = deriveManagementSecret(ENV.BETTER_AUTH_SECRET);

const reservations = createReservationsService<RequestContext>({
  mode: "stay", // Choose "appointment" for fixed-duration services.
  db,
  authorize: async (context, action) => {
    const session = await readFreshHostSession(context);
    if (!session) return false;
    if (action === "settings") return session.user.role === "admin";
    return hostMayManageAppointments(session.user);
  },
  managementSecret,
  getManagementUrl: (token) => `${ENV.SITE_URL}/reservations/manage#${token}`,
  sendEmail: async ({ id, to, subject, text }) => {
    await hostEmail.send({ to, subject, text, idempotencyKey: id });
  },
  // Optional: return translated/branded { subject, text } using email.locale.
  formatEmail: formatReservationEmail,
});
```

The application supplies the identifiers in this example. `readFreshHostSession`
must read the server session; no role or identity submitted by a browser is trusted.
Authorization runs on every protected read and write. `read`, `manage`, and `settings`
are the only actions. Hiding controls is not authorization.

`deriveManagementSecret` uses HKDF-SHA256 with an empty salt, the fixed context
`forge/reservations-management/v1`, and 32 output bytes encoded as base64url. It
rejects root secrets shorter than 32 bytes. Pass the same derived key to the service
and any direct `signManagementLink` calls. The helper does not read environment
variables or depend on Better Auth; other hosts supply their own root secret.
The existing `managementSecret` option still accepts a directly supplied key.
Switching from a separate key to a derived key invalidates earlier links; no
legacy-key fallback is provided. Keep the root secret stable across restarts.

Bind `reservations.publicClient` to a `ReservationsPublicClient` transport.
Bind `reservations.adminClient(serverContext)` to a `ReservationsAdminClient`
transport after resolving the host context. Never dispatch arbitrary method names
from request parameters. Hosts decide the route URLs; no HTTP routes ship automatically.

For guest management, read the URL fragment on the client and pass its token in a
protected request header or POST body to handlers bound through
`reservations.managementClient(token)`. Fragments keep the token out of normal HTTP
URL/referrer logs. Use `Cache-Control: private, no-store`, a `no-referrer` policy,
and no indexing or analytics on the management page. Redact tokens and customer data
from application logs. Opening the link only reads; changes require explicit actions.

Pass the host's localized booking URL as `ReservationManagePage.backHref` to show
a back arrow beside the heading, including during loading and errors. It uses
`labels.back` for its accessible name and tooltip. Omit `backHref` to keep the
heading without a back control. Supply `linkComponent` for router-aware navigation
using the existing `href` link contract; the default is the registry Link shim.
The destination belongs to the host and must not include the private management token.

Map only `ReservationError.code` to safe responses. `MODE_MISMATCH`, `INVALID`, `NOT_FOUND`,
`FORBIDDEN`, `CONFLICT`, `CUTOFF`, `CLOSED`, `INVALID_LINK`, and `STORAGE` are the
published error codes. Do not forward raw SQL, email-provider errors or credentials.
Preserve the error code in the browser adapter so the UI can show its translated message.

## Installation mode and compatibility

The required `mode` option is `"appointment"` or `"stay"`. Configure it once in
the host server adapter. Catalog and staff configuration expose `mode`; UI components
read it from their clients. It is not an editable business setting or per-service
choice. Existing adapters must explicitly pass `mode: "appointment"` when updating.

The first successful setup mutation records mode in the settings JSON under the
scheduling lock. Empty-installation reads do not write settings. Older settings or
records without a mode are treated as appointments. An incompatible host mode fails
with `MODE_MISMATCH` without converting data. Changing an established installation's
mode needs a separate migration; it is not supported by the settings UI.

Stay policy, booking mode, departure date, night count and resource closures use
additional JSON document fields. Existing UTC columns and indexes already support
multi-day ranges, so this update needs no DDL migration. Do not reapply the original
creation SQL to an existing database. Installation does not migrate stored data.

## Overnight stays

Create stay offerings with `mode: "stay"`, `arrivalStart`, `arrivalEnd`,
`checkoutTime`, `minNights` and `maxNights`, plus the common policy and service
fields. Omit `durationMinutes`. The arrival window includes its start and excludes
its end; slots step from its start using `intervalMinutes`. Set the window and
checkout explicitly. `reservationStayPolicyDefaults` supplies 1–30 nights and the
common defaults; both night limits are editable within 1–365.

Availability takes `{ serviceId, resourceId?, date, departureDate }`, where `date`
is the local arrival date. Booking and rescheduling add `departureDate` to the
existing input and use a `startsAt` returned by availability. The server derives
`endsAt` using checkout time. Reservations return `mode`, `departureDate`, `nights`
and a complete policy snapshot. The client never supplies an authoritative end.

Arrival must be within the saved booking horizon and respect minimum notice. The
departure may exceed that horizon within the maximum nights. At least one overnight
stay is required. Nights are local date differences, not elapsed 24-hour periods.
Nonexistent arrival times are omitted; repeated arrivals have distinct UTC offsets.
A nonexistent checkout makes that departure unavailable; repeated checkout uses the
later occurrence. Policy edits do not change existing stays or their rescheduling.

In stay mode, resource `weeklyHours` and `exceptions` are empty. Active resources
are continuously available except for reservations and `blockedDates`, an array of
`{ from: "YYYY-MM-DD", through: "YYYY-MM-DD" }` with both dates included. New resources
start inactive. Closures use local midnight boundaries and cannot overlap active
reservations, including their buffers. Resources never combine to cover parts of
one stay; automatic assignment finds one eligible resource for the entire interval.

Preparation precedes arrival; cleanup follows checkout. For example, 11:00 checkout
with two hours of cleanup permits another arrival at 13:00, or 13:30 if the next
booking requires 30 minutes of preparation. Both slots still respect their arrival
window. Pending and confirmed stays block time, including intermediate dates.

Forms show arrival/departure inputs, a calendar range, arrival choices and a review.
Focusing either date input selects which endpoint the calendar edits; no separate
arrival/departure buttons are shown.
While Departure date is active, clicking a date before the selected arrival sets
that date as the new arrival, activates Arrival date and focuses its input. The
departure stays unchanged. Dates on or after arrival still follow the minimum-night
restriction for departure; a date between the two endpoints edits departure.
Private and staff rescheduling use the same rules. Details and emails show both
endpoints and nights. Year counts every local date intersecting arrival-to-checkout,
including checkout day when checkout is after midnight; cleanup is not another stay.

## Appointment booking model

One installation has one host-selected mode and one business time zone. Set it explicitly before enabling
public booking. The unconfigured service returns UTC with public booking disabled;
there are no default open resources. Resources have weekly hours keyed by ISO
weekday, `1` for Monday through `7` for Sunday. Separate intervals represent breaks.
Date exceptions replace a whole day's weekly schedule. An empty exception closes
the date; removing an exception restores weekly hours. Intervals cannot overlap.
`24:00` is supported as an interval end; overnight schedules use separate dates.

Each service owns its duration, eligible resources, active status, preparation and
cleanup buffers, cancellation notice, approval mode, minimum booking notice, booking
horizon and start-time interval. Defaults are automatic approval, zero buffers,
24-hour cancellation notice, one-hour booking notice, 90-day horizon, and 15-minute
intervals. Duration is required. Service/resource IDs are host-generated UUIDs; a new
record uses version `0`. Saves return the incremented version. Referenced records
are archived rather than deleted.

The settings overview and individual editors provide a trash action to archive a
service or resource after confirmation. The overview updates in place, retains
archived rows and existing reservations, and keeps the confirmation open on failure
so staff can retry.

The whole occupied interval is `[start - preparation, end + cleanup)`. Both buffers
must fit inside a working interval, and adjacent occupied intervals may touch.
Starts align with each working interval's start, using the service interval. A
09:00–09:45 appointment with 15 minutes of cleanup blocks until 10:00. If the next
appointment also needs 15 minutes of preparation, its earliest start is 10:15.

Customers may choose a resource or omit it for automatic assignment. The server
selects the first available eligible resource in ID order while holding the scheduling
lock. Availability responses contain only start/end instants, not customer details.
Availability queries cover one local date. Calendar queries are limited to 43 elapsed
days so a six-week month including a daylight-saving transition fits.

Guest and staff appointment creation disable dates without available slots for the
selected service and resource. Hosts may expose the optional
`monthAvailability({ serviceId, resourceId?, month })` method on their public and
admin clients. `month` is the first local calendar date of the viewed month
(`YYYY-MM-01`). The result maps each of the 42 displayed dates, starting on the
Monday on or before that date, to a boolean. The companion validates the request
and computes the grid using one configuration read, one occupied-reservation read
and one captured time. Public and staff rules remain distinct; the admin method
requires the existing `read` permission. Stay installations reject this operation.

Forward this optional method through the host's existing transport and authorization.
Hosts that omit it continue to use 42 daily availability calls; retain rate limits
that allow that fallback. An implemented batch that fails shows the existing error
and refresh action instead of falling back to daily calls. Dates remain disabled
while loading or after failure, and superseded results cannot replace the current
month. The selected day's slots load separately through `availability`; booking
still rechecks capacity on the server. Stay booking, rescheduling and staff calendar
inspection retain their existing reads. No database migration is required.

Duration is elapsed minutes. The Temporal dependency resolves IANA time zones without
changing globals. Nonexistent local starts are omitted; repeated starts are separate
UTC instants. Time-slot buttons show only local times, with the UTC offset at the
top right of their group. Dates spanning an offset change use separate groups so
repeated local times remain distinguishable. An opening/closing boundary inside a
daylight-saving gap closes that working interval instead of silently moving the boundary.

Pending and confirmed bookings occupy capacity. Pending requests never expire
automatically. Staff can approve or reject pending requests and cancel active bookings;
approval after the appointment starts is rejected. Customers may cancel or reschedule
strictly before the saved cancellation deadline and appointment start. Staff may bypass
the cancellation deadline and minimum booking notice but cannot bypass working hours,
resource eligibility, the booking horizon or conflicts.

Bookings snapshot their policy and time zone. Service edits apply to new bookings;
rescheduling keeps the original service and policy. A successful move releases the old
time and acquires the new time atomically. Manual-policy moves return to pending.
A failed move leaves the original untouched. Schedule changes flag existing bookings
outside revised hours. Date exceptions excluding active bookings cannot be saved.
Changing the business time zone preserves existing appointment instants and their
display zone. Availability, schedule checks and newly rescheduled bookings use the
current business zone; the management client exposes it separately for time selection.

All scheduling writes use one transaction-level advisory lock per database and
recalculate availability after locking. Use the service for all writes. Direct SQL
changes bypass this protocol. Requests also check record versions. Retrying a booking
requires the same UUID request ID and normalized payload; changing that payload with
the same key returns `CONFLICT`. A successful replay returns the current reservation.

## Components

| Component                 | Host inputs                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `ReservationBookingPage`  | Public client, locale, optional labels/initial date, optional `onBooked`                       |
| `ReservationManagePage`   | Management client already bound to a private token, locale and labels                          |
| `ReservationsCalendar`    | Admin client, required `newHref`, locale, optional settings link, link adapter and `canManage` |
| `ReservationNewPage`      | Admin client, `backHref`, `onBooked`, locale, labels and optional initial date                 |
| `ReservationSettingsPage` | Admin client, service/resource editor destinations, back link and link adapter                 |

All components accept `className`; English labels are overridable. Pass a stable client
object so loading does not restart on every parent render. Settings support
`editor={{ kind: "service" | "resource", id }}` with `id: "new"` for creation.
Use dedicated host routes for these editors. The optional `onSaved(kind, id)` can
navigate a new item to its edit URL. The showroom demonstrates these adapters.

Staff creation uses a dedicated host route such as `/admin/reservations/new`.
Pass its URL as `ReservationsCalendar.newHref` and render `ReservationNewPage`
there with the authenticated admin client. Preserve the calendar query and fragment
in the creation/back links, pass the selected date as `initialDate`, and return to
the calendar from `onBooked` after saving. The showroom demonstrates reload and
Back/Forward with this route. Existing hosts adopting this change must add the route
and `newHref`; the calendar no longer opens a creation dialog. Guard the new route
with the same staff authorization as the calendar; the server still authorizes each
request. Staff booking remains available when public booking is disabled.

`ReservationsCalendar` opens in List on desktop and mobile. Its Month view uses the
same exported `DatePicker` used in public booking, staff creation and stay forms.
Staff see filtered reservation counts and select a date to open its reservation
list beside the grid (below it on mobile). Selecting a reservation opens the existing
details and actions. Year, Month, Week, Day and List remain available in the toolbar.

Pass optional `calendarState={{ view, date }}` and `onCalendarStateChange` to bind
navigation to host URLs. `ReservationCalendarState` uses an ISO local date and
`reservationsMonth`, `reservationsYear`, `timeGridWeek`, `timeGridDay` or `listWeek`.
The showroom validates `view` and `date`, defaults to List and the example date,
removes default values, and restores navigation on reload and Back/Forward.
Existing hosts may omit these props for local navigation. To use Month as a
host default, supply `reservationsMonth`. No customer site is updated by this registry change.

List replaces the date-limited Agenda. It shows all reservations across all dates
and statuses, ordered by start time then ID, with the existing filters and detail
actions. Date arrows, Today and the period heading are hidden in List; reservation
rows still show their start/end dates. The footer uses shared pagination, with
20 reservations per page and disabled controls at the first/last page.

Hosts must expose the new authenticated `ReservationsAdminClient.listPage` method:
`listPage({ page, resourceId?, serviceId?, status? })` returns `{ items, hasMore }`.
Pages are positive integers up to 1,000,000. The service validates inputs and applies
filters, ordering, limit and offset in PostgreSQL before returning rows. Calendar
`list` reads keep their existing 43-day maximum. Update the UI, storage companion
and host transport together; no database migration is required.

Pass optional `page` and `onPageChange` props for controlled pagination. Hosts reset
`page` to 1 when filters change. Uncontrolled usage resets locally. The showroom
validates `reservationPage`, omits page 1, resets it when filters change, and restores
it on reload and Back/Forward. `listWeek` and the `agenda` label key remain compatible;
the English label now defaults to List. Translate `pagination`, `previousPage`,
`nextPage` and `emptyList` through the existing label overrides.

`DatePicker` accepts controlled `month` / `onMonthChange`, optional reservation
`counts`, optional `monthAvailability(month)` for date booleans, and the existing
date/range/availability props. The month callback takes precedence over daily
availability when supplied. It owns the Monday-first
42-day grid, translated navigation, range highlighting and disabled-date behavior.
Stay endpoint rules and server availability checks remain unchanged.

`ReservationsCalendar` accepts optional controlled `filters` and `onFiltersChange`
props using the exported `ReservationFilters` type. It contains `resourceId`,
`serviceId` and `status`; omitted values mean All. Without `filters`, the calendar
keeps its own filter state. Hosts own URL parsing and navigation. The showroom
stores non-default filters in matching query parameters, restores them on reload
and Back/Forward, and removes each parameter when its dropdown returns to All.
Malformed IDs and unsupported statuses fall back to All. Filter changes preserve
other query parameters and the URL fragment.

The Year view shows twelve months starting at the current calendar month, with one
month per row and a count of matching reservations on each date. Appointments count
on their start date; stays count on every date they intersect. It keeps the resource,
service and status filters. Selecting a date opens Day view. Arrow keys move between
dates and month rows; Home/End move to the first/last day of a month. The month labels
stay visible during horizontal scrolling on small screens.

The Year view splits reads into at most nine bounded requests and deduplicates
reservations that cross request boundaries. Hosts keep the existing `list` contract
and 43-day maximum. A failed request reports an error instead of displaying partial
counts. Dates and counts use the business time zone, including leap days.

FullCalendar uses its free standard views, the shared month picker and a custom React year table. There are no premium resource columns,
dragging, recurring rules or calendar integrations. Resources are selected with filters.
The calendar's stylesheet imports its required package CSS and maps colors to the
host's semantic variables. Supply the shared `status-success`, `status-pending` and
`status-canceled` background/foreground pairs and Tailwind mappings. Never copy the
showroom stylesheet wholesale. Keep the plugin's source in the host's Tailwind scan.

## Emails and private links

The service commits a notification job in the same transaction as each booking,
approval, rejection, cancellation, rescheduling or link replacement. The worker sends
jobs in reservation-version order with a five-minute lease and exponential backoff,
capped at one day. Failed jobs remain retryable, and staff can make them immediately
eligible with `retryEmail`. That operation queues a retry; the host runs the worker.
Email failures never undo reservations. Defaults provide English plain-text content;
`formatEmail` supplies translations and branding.

The stable notification ID should be the provider's idempotency key. A process crash
between delivery and acknowledgement can otherwise produce a duplicate email; delivery
is at least once, not exactly once. No separate queue service is required.

Links are HMAC-signed and identify only one reservation. They expire 30 days after
the later of delivery time and the current appointment end. Staff `revokeLink` increments
the revocation version and queues a replacement. Rotating the host secret invalidates
all previous links. Cancellation remains governed by the server cutoff, regardless
of the link's expiry. The plugin stores contact details only, with no clinical notes,
diagnoses or patient records.

## Showroom and verification

Open `/en/reservations`, `/fr/reservations`, or `/en/admin/reservations`.
The provider shares in-memory state across pages; reloading resets it. Choose
Hairdresser, Clinic or Apartment, use Many reservations to test pagination across past and future bookings,
simulate failed mutations and slow responses, and inspect
the latest booking through the demo inbox. The inbox uses mock IDs, sends no email,
and must never be used as a production authorization adapter.

```sh
pnpm test
docker compose -f tests/reservations-storage/compose.yaml up -d --wait
pnpm test:reservations-storage
TEST_BASE_URL=http://localhost:3215 node --test tests/reservations.browser.mjs
docker compose -f tests/reservations-storage/compose.yaml down
```

The PostgreSQL test drops only reservation tables in its dedicated local
`reservations_test` database. Never point it at a customer database. Browser tests
expect a running showroom. Run the repository format/lint/build checks, regenerate
registry output, and verify a disposable shadcn consumer install before publication.

This release does not install the plugin into forge-template or tc-website and does
not deploy a website. Payments, reminders, groups, recurring bookings,
multiple simultaneous resources, and external calendar synchronization are excluded.

## Action confirmations

Successful updates use the shared [action toast](./action-toast.md). Errors stay
with the form. The dependency installs automatically; wrap the persistent host
layout in `ActionToastProvider` to retain confirmations across navigation and
translate its Close label. Existing callback and label props are unchanged.

## Optimistic updates

See the [optimistic action contract](./optimistic-actions.md) for immediate UI
changes, rollback, server-confirmed operations and host callback requirements.
The plugin installs its TanStack Query dependency through `@forge/optimistic-action`.

## Notification layout

The storage item installs [`@forge/mailing`](./mailing.md) for its default HTML and
plain-text notifications. Forward `email.html` alongside `email.text` in the host
transport, or use `sendResendEmail`. `formatEmail` can return optional `html`, synchronously or as a promise;
existing subject/text overrides remain valid and do not receive default HTML.
Delivery IDs, durable jobs, retries and host authorization are unchanged.
