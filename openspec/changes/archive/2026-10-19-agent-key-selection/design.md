## Design

`registry/components/plugins/auth/agent-keys.tsx` owns listing and confirmed
single-key deletion. Reuse its native checkbox conventions, KeyDialog, IconTooltip,
lock and `onDelete(id)` callback. Keep selection local to the table, derive it from
current metadata and clear removed IDs. Snapshot keys when opening confirmation.
Delete sequentially so host cache refreshes do not race; retain only failed keys
for retry. Native indeterminate state provides keyboard and assistive-technology
semantics. Reserve the action cell height before selection.

The `auth` manifest already ships the component and labels. Reverse dependencies
are `intranet-sidebar` and `intranet-shell`; no import or dependency changes are
needed. `AccountPreview` supplies two demo keys and a partial-failure control.
Existing host callbacks and optional creation remain compatible. Hosts may add
translations for the new SecurityLabels; English defaults remain available.

The consumer inventory records forge-template, L'Aspic, osthoepathie-seebach,
Sinigest, Soleva, Terminal60 and TC Auth integrations. Adoption is separate from
this registry task. Source refresh and deployment remain pending; unlisted
consumers are unknown. The host must still authorize each deletion.
