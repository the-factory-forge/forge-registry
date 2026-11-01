## Context and decisions

Reuse `@forge/dialog-submit`: the handler clicks the form's existing submit button
so native validation and domain submit guards stay authoritative. Export the neutral
`submitFormOnShortcut` name while preserving `submitDialogOnShortcut` as an alias.
Attach it to forms; keep existing popup handlers for focus anywhere in a modal.
Keep portal containment, composition, repeat and disabled checks. Ordinary Enter
is unchanged. Forms without a submit button retain native behavior, including
Blog search's implicit GET submission. No dependency or provider is introduced.

The user's request supersedes the previous standalone-form exclusion. Drive's
already-open deletion confirmation uses its actual submit button too; shortcuts
never open confirmations or invoke unrelated action buttons such as Agent approvals.

## Risks and verification

Verify both modifiers, multiline Enter, validation, pending/disabled submits,
failure retry and portal isolation. Cover page editors, the Agents composer and
existing dialogs in browser tests. Rebuild official artifacts, check dependency
closure and install affected items into an isolated shadcn consumer.

## Adoption

No breaking prop or import change. Hosts adopt affected UI items and the utility
through shadcn, preserving their adapters, then test their own callbacks. Registry
publication does not update deployed websites or the template automatically.
