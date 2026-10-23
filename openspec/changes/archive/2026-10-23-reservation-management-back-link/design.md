## Context

Registry baseline: d1d3f189cbb19f99e3af448511a2c0e9d591e3c3.
L’Aspic baseline: d5cc3286c19e7933e1039527af58de289c108ad5 plus existing local
open-stay edits. Its installed public component is adapted source, not an exact
registry revision. Only the management heading change is reconciled.

## Decisions

Add optional `backHref` and the existing `linkComponent` adapter pattern to
`ReservationManagePage`. Reuse `labels.back`, IconTooltip, buttonClass and the
Link shim. A fixed host destination works for direct links; browser history
cannot reliably identify the booking page. The heading and link sit outside
load/error branches. L’Aspic supplies `/fr/reservations`; showroom supplies its
current locale and keeps its in-memory demo through client-side navigation.

`reservations` owns public.tsx; `reservations-storage` depends on it. Existing
manifest dependencies already include ui-shims and icon-tooltip. The consumer
inventory records only L’Aspic for Reservations. forge-template source at
e44fd9e85bd7d7e7253c25cc1fe2e44c398ef1e8 has no installation or caller.
Unlisted installations are unknown. Hosts that omit backHref remain compatible.

## Verification

Check keyboard activation, translated tooltip/Escape, direct invalid URLs,
mobile/desktop and both themes. Run the existing full booking journey, registry
checks and an official shadcn installation against generated local output.
Publication and deployment are separate, unverified actions.
