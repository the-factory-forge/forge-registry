# Supports–GitHub text-first v1

Implement the approved private-repository bridge as optional registry source.
The common use case is sending website maintenance discussions to the development
team's private GitHub issue tracker while staff continue using Supports.

The owning change is forge-registry. Generic Supports hooks/imports and a detail
slot support connector composition; GitHub identity, jobs, mappings and receipts
stay in connector persistence. Host adoption and live provider writes are excluded.
See the [requirements](../../specs/plugins/spec.md#requirement-supportsgithub-connector)
and [implementation/runbook](../../../docs/supports-github.md).

Image copying, edit/delete mirroring, repository migration automation and consumer
installation are deferred. Active mentions, closure before deployment and separate
source-image authorization are accepted behavior. Production adoption requires
host migrations, App setup, schedules, monitoring and private-repository acceptance.
