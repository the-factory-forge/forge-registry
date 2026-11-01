# Proposal

## Why

Cmd/Ctrl+Enter currently works in a few modal forms but not in the Agents composer
or standalone editors. People expect the same submit shortcut throughout the UI.

## What Changes

- Apply the existing guarded shortcut to submission forms throughout registry UI.
- Preserve normal Enter, validation, pending states, confirmations and recovery.
- Ship the shared dependency with every affected item; retain the existing export.

## Capabilities

### Modified Capabilities

- `plugins`: Extend the modal shortcut requirement to all plugin forms.

## Impact

Registry-owned UI only: Agents, Auth and email changes, Blogs, Customers, Projects,
Menus, Reservations, Drive, Customers–Bexio, Newsletter and Footer. Existing
Employees and image-crop shortcuts remain supported. No host API or database change.

Recorded consumers include forge-template (Auth and Employees), TC website and
websites using Blogs or Reservations. Their installed copies require reviewed
source adoption; no consumer or deployment is changed in this task. Public Footer
and Newsletter copies also need inspection when adopted. The registry owns this
change and its plugin specification.
