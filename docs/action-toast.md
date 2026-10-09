# Action toast

`@forge/action-toast` supplies `ActionToastProvider`, its props type, and
`useActionToast` for brief success confirmations. It uses the existing Base UI
Toast dependency and the host's semantic popover, ring and status-success tokens.

```tsx
import { ActionToastProvider, useActionToast } from "@/components/action-toast";

function SaveButton() {
  const notify = useActionToast();
  return <button onClick={() => notify("Project updated.")}>Save changes</button>;
}

<ActionToastProvider closeLabel="Close">
  <SaveButton />
</ActionToastProvider>;
```

Call `notify` after the mutation succeeds. Keep pending guards, validation and
error recovery in the form. Pass translated messages to `notify` and translate
`closeLabel` on the provider. Notifications stack at the top right, expire
after five seconds and pause while hovered or focused. Close and Escape dismiss
them; Base UI announces updates without moving keyboard focus.

Affected plugin entrypoints include a provider, so standalone pages need no
setup. Nested providers share their parent's queue. Wrap the host's persistent
application layout once to keep confirmations across client-side navigation
and set its translated Close label. Full page loads clear notifications.

Projects, Customers, Blogs, Menus, reservation settings, employee verification
and password changes use this component. Drive keeps its existing bottom-right upload and
recovery toast queue. Booking receipts, reset instructions, loading and empty
states remain in the page. The [showroom example](../src/routes/action-toast.tsx)
includes success, repeated saves and simulated failure.
