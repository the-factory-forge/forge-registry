## Why

Drive accepts dropped files but its small static hint does not make the target
clear during a drag.

## What Changes

- Cover the existing drop area with themed upload guidance during a file drag.
- Clear feedback on exit, drop, cancellation and unavailable upload actions.
- Preserve the current upload queue, permissions and validation.

## Capabilities

- Added to `plugins`: Drive upload drop feedback.

## Impact

Owning root: forge-spec. Source, translated labels, browser checks and generated
Drive output belong to forge-registry. No dependencies or storage APIs change.
Consumer source adoption remains a separate update.
