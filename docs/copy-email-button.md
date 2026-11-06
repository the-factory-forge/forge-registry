# Copy email button

Install `@forge/copy-email-button` with shadcn. Preview the
[showroom example](https://registry.the-corner.swiss/copy-email-button), or run
`/copy-email-button` locally before publication.

```tsx
import { ActionToastProvider } from "@/components/action-toast";
import { CopyEmailButton } from "@/components/copy-email-button";

<ActionToastProvider closeLabel="Close">
  <div className="flex min-w-0 items-center gap-1">
    <span className="truncate">{email}</span>
    <CopyEmailButton email={email} />
  </div>
</ActionToastProvider>;
```

Use the existing application `ActionToastProvider` when available. The item ships
its tooltip, toast and `cn` dependencies; it adds no router or account dependency.
Hosts keep ownership of the displayed email, profile layout and permissions.

The native button copies the exact `email` prop only after activation. Its tooltip
opens on hover or keyboard focus, and the button has a visible focus ring. Success
appears only after the clipboard write resolves. Rejected or unavailable clipboard
access shows an error with a manual-copy fallback. An empty address disables the
button. The control stays beside truncated text on narrow layouts.

`CopyEmailButtonProps` exports `email`, `label`, `copiedLabel`, `errorLabel` and
`className`. Translate the three labels and the provider's Close label for localized
interfaces. Default controls measure 32px on desktop and 40px on narrow screens.
Clipboard access normally requires HTTPS or localhost and a user action.

This control promotes TC's `ProfileSummaryCard` email button. TC already implements
the same behavior using its own Button and Sonner feedback, so its source is retained
without an installed `copy-email-button` item or a broader Auth/Employees refresh.
