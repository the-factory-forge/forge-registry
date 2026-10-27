# Add reservations

## Why

Forge needs reusable appointment and overnight stay booking, with public guest booking and staff scheduling. No existing registry item owns booking rules or persistence.

## What changes

- Add `@forge/reservations` and `@forge/reservations-storage`.
- Support host-selected appointment or stay mode, arrival/departure dates, checkout and blocked dates.
- Support fixed-duration services, individual resources, working hours, date exceptions, buffers, approval, cancellation and rescheduling.
- Deliver private management links and durable customer notifications.
- Add a discoverable bilingual showroom, server integration tests and consumer installation verification.

## Capabilities

### New capabilities

- `reservations`: Portable appointment booking and server integration.

## Impact

This is the sole owning OpenSpec root. The Reservations specification and implementation belong to forge-registry; cross-repository integration contracts remain in forge-spec. Consumers explicitly install the items and wire routes, fresh authorization, email transport and migrations. Existing consumers and deployments are unchanged. Payments, recurring bookings, reminders and external calendar synchronization are excluded.
