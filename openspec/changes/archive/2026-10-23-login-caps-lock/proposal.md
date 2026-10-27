## Why

People entering a password cannot see when Caps Lock is active, which can cause a failed sign-in.

## What Changes

- Show a Caps Lock icon inside the focused login password field when browser input events report it active.
- Add an overridable English status label and French, English, German, and Italian translations in Forge Template.
- Rebuild the auth registry item and update the template's installed login component, preserving its adapters.

## Capabilities

### New Capabilities

- `login-caps-lock`: Accessible Caps Lock feedback in the login password field.

### Modified Capabilities

None.

## Impact

Owns changes to `forge-registry` auth source and generated distribution. Updates the installed component and dictionaries in `forge-template`. Existing callbacks and routes remain compatible. Other customer sites are outside this change.
