## Context

The auth registry item owns `LoginForm`; Forge Template currently installs it under `src/intranet/components/forge/plugins/login`. The registry now calls the item `auth`, so the consumer update must preserve the template's existing imports and adapters.

## Goals / Non-Goals

Show an accessible Caps Lock indicator beside the existing password visibility button. Do not change authentication, password values, other forms, or customer sites.

## Decisions

Use native keyboard and click modifier state with local React state. Clear the indicator on blur. Keep an empty status region mounted for announcements, connect it through `aria-describedby` while active, and reserve input padding for the icon. Use Lucide and semantic colors already shipped by the auth item. Add `capsLockOn` to the existing overridable labels.

## Risks / Trade-offs

Browsers only expose the state on input events. Focusing without an input event does not reveal the hardware state. Do not infer it from uppercase characters or add global listeners.

## Migration Plan

Regenerate `public/r/auth.json`, test installation with a local registry namespace, and adapt only the changed component and labels into the template's existing login directory. Preserve host link and class-name adapters and unrelated local changes.
