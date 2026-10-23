# Design

`AccountPage` accepts site-supplied tabs and controlled navigation. The site owns
URL state and access checks; plugins do not register tabs or fetch data themselves.
Existing default and custom account integrations remain supported.

`AccountEmailChange` calls the site's authentication handler. That handler checks
the current administrator and uses the provider's confirmation flow. Switching
tabs keeps form input, pending requests and feedback available.

This contract covers confirmation in About. The older Employees administrative
email path is outside its scope.

See the [requirements](specs/plugins/spec.md) for permission and failure rules,
and [Registry PR #18](https://github.com/the-factory-forge/forge-registry/pull/18)
for implementation. Delivery evidence remains in [tasks.md](tasks.md).
