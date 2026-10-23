## Why

Agent keys currently require one deletion confirmation per row. Users need to
select several keys and confirm their deletion together.

## What Changes

Add row and mixed-state select-all checkboxes plus a conditional bulk delete
control. Keep the existing per-key callback and preserve partial-failure retries.
This is reusable account security UI without customer-specific permissions.

## Capabilities

### Modified Capabilities

- `plugins`: add agent-key selection and confirmed bulk deletion to Auth.

## Impact

The owning OpenSpec root is forge-spec. forge-registry owns the component, labels,
showroom, tests, guides and generated Auth item. No new dependencies, server API,
schema or consumer changes are required. Existing sites adopt source separately.
