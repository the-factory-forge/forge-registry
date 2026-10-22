# Action toast

`@forge/action-toast` supplies `ActionToastProvider`, its props type, and
`useActionToast` for brief success confirmations. All registry toasts, including
Drive uploads, downloads and recovery actions, use this provider and renderer.
Use its existing Base UI manager for background operations. Do not add a separate
provider, viewport or toast frame to a plugin. Hosts supply the semantic popover,
ring, status-pending, status-success, status-info and destructive tokens.

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
`closeLabel` on the provider. Notifications form a compact layered stack at the
bottom right, with the newest in front. Hover, touch or keyboard focus (F6) expands
the stack into a scrollable list so every message and recovery action is reachable.
Toasts use [shadcn’s Base UI motion](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/toast.tsx):
500 ms position/scale transitions, 150 ms height transitions and sliding entrance,
exit and swipe dismissal. Reduced-motion preferences disable these transitions.
They expire after five seconds and pause while hovered or focused. Close and Escape dismiss
them; Base UI announces updates without moving keyboard focus.

Affected plugin entrypoints include a provider, so standalone pages need no
setup. Nested providers share their parent's queue. Wrap the host's persistent
application layout once to keep confirmations across client-side navigation
and set its translated Close label. Full page loads clear notifications.

Projects, Customers, Blogs, Menus, reservation settings, employee verification
and password changes use this component. Drive joins the same queue, including
when embedded in another plugin. Booking receipts, reset instructions, loading and empty
states remain in the page. The [showroom example](https://registry.the-corner.io/action-toast)
includes success, repeated saves, background loading and simulated failures.

## Shared layout and background operations

Toasts use one compact frame, a leading status icon and a translated Close control
at the top right. Loading uses an orange spinner, success a green check, errors a
red alert and information a blue icon. Spinners respect reduced motion. Optional
status/details belong in the footer on the left; Dismiss, Undo and other actions
align right with 8px gaps and wrap on narrow screens. Simple confirmations keep
their single message without adding a redundant status label.

Inside `ActionToastProvider`, call `Toast.useToastManager<ActionToastData>()` from
`@base-ui/react/toast`. Use `add`, `update` or `promise` to update one toast through
its loading and result states. Put status/details in `description` and the action
in `actionProps`. Keep pending actions mounted and disabled. Use `timeout: 0` when
a pending or failed operation must remain available for recovery.

`ActionToastData` supports `closeLabel` for a translated per-toast override,
`content` for structured content such as upload batches, and `dismissible: false`
to prevent Close, Escape and swipe dismissal while recovery is required. Reuse
`ActionToastFooter` with its `status` and `actions` props and
`actionToastButtonClass` inside custom content. These exports ship with the same
item. Upload bars use the matching semantic status color.

Nested providers inherit the existing queue and Close label unless overridden.
Transient upload batches have separate IDs per browser and close when that browser
unmounts; the upload hook retains its cancellation behavior. Context-bound Drive Undo controls also close when their browser unmounts.
Other confirmations can survive navigation under a persistent host provider. Active and failed uploads
are not hidden by a toast count limit.

Consumers updating Drive must also refresh `@forge/action-toast` and its declared
`@forge/cn` dependency. All other installed plugins using `@forge/action-toast`
receive the shared layout when that source is refreshed. No mutation API changes
or storage migrations are required.
