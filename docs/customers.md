# Customers plugin

Install the complete feature UI into an initialized shadcn project:

```bash
pnpm dlx shadcn@4.19.1 add @forge/customers
```

All plugin files install under your components alias at `plugins/customers/`.
Import the three pages and their types from `@/components/plugins/customers`.
The item includes Base UI and Lucide dependencies and the Forge `cn` and
`ui-shims` items. Review shim changes when updating an existing installation.
The plugin needs React and Tailwind 4 with standard semantic theme tokens;
it does not depend on the showroom CSS, providers, or framework.

## Pages and host integration

| Component            | Required host inputs                                                                        | Optional integration                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CustomersPage`      | `customers`, `search`, `onSearchChange`, `createHref`, `getCustomerHref(customer, section)` | `loading`, `error`, `onDelete(id)`, `onSetVerified(id, verified)`, `onImpersonate(id)`, `toolbar`, `syncColumn: { label, render(customer) }` |
| `CustomerDetailPage` | `customer`, `backHref`, `sectionHrefs`, `onSave(values)`                                    | `section` (defaults to `about`), `onDelete(id)`, `emailChangeDescription`, `projectsContent`, `syncContent`                                  |
| `CustomerNewPage`    | `backHref`, `onCreate(values)`                                                              | `passwordMinLength` (12), `passwordMaxLength` (128)                                                                                          |

Every page accepts `className`, `labels: Partial<CustomersLabels>`, and
`linkComponent`. All callback mutations return `Promise<void>`: resolve only
after success, and reject on failure. The component prevents duplicate
submissions and displays overridable generic feedback. If an SDK returns an
error object instead of rejecting, check it and throw in the host callback.

The host loads and filters customers, refreshes data after mutations, and owns
navigation after creation, deletion, or impersonation. The plugin makes no API
calls and does not assume an auth provider, database, or query library.
Omitted action callbacks hide their controls. This is UI configuration, not an
authorization boundary: enforce access on every server operation.

```tsx
import {
  CustomerDetailPage,
  type Customer,
  type CustomerFormValues,
} from "@/components/plugins/customers";

export function CustomerScreen({
  customer,
  save,
}: {
  customer: Customer;
  save: (values: CustomerFormValues) => Promise<void>;
}) {
  const base = `/internal/customers/${encodeURIComponent(customer.id)}`;
  return (
    <CustomerDetailPage
      customer={customer}
      backHref="/internal/customers"
      sectionHrefs={{ about: base, projects: `${base}/projects`, sync: `${base}/sync` }}
      onSave={save}
    />
  );
}
```

Use `section="projects"` or `section="sync"` on those host routes. Both sections
are empty unless their content props are supplied. There is no project model,
sync service, invitation UI, or Bexio dependency. The host may provide a sync
column and toolbar independently of the detail content.

Links default to the Forge Link shim. For client navigation pass a stable
adapter preserving `LinkProps` from `@/components/link`; for TanStack Router,
map `href` to `to`. Define adapters outside rendering components. Actual route
files belong to the consuming app and are not installed by the registry.

## Form and data contract

`Customer` includes `id`, `name`, `email`, `emailVerified`, optional `image` and
`banned`, and optional nullable `companyName`, `phoneNumber`, `street`, `city`,
and `addressComplement`. Company name takes precedence over contact name in the
summary and directory. `city` retains TC's combined postal-code/city field.

`CustomerFormValues` contains strings for the seven editable contact/company/
address fields. Empty optional fields submit as empty strings; map these to
database nulls in the host if needed. Name and email are trimmed on submission.
`CustomerCreateValues` adds an optional password, omitted when empty. Edit
submissions never contain a password.

Name is required. Email is optional on creation unless a password is supplied;
editing requires an email, and nonempty emails must be valid. The host decides
how to persist contacts without email; this UI never invents placeholder
addresses. Password bounds can be overridden (positive integer bounds up to
1024, maximum at least minimum). Generation uses Web Crypto and prefers 20
characters within those bounds. Account provisioning and password policies must
also be enforced on the server. Passwords are cleared after successful creation
and are never persisted by the plugin. Clipboard failure leaves the generated
value available for manual copying.

The form retains failed submissions and drafts across same-customer rerenders.
Changing the customer ID resets the form. To deliberately reload an existing
customer's form from fresh server values, remount `CustomerDetailPage` with a
host-controlled React key. Navigating away from About discards its unsaved draft.
Only pass `emailChangeDescription` when the host implements the described
session or verification behavior.

All copy, including dynamic delete confirmation and password descriptions, can
be overridden through `labels`. The UI uses accessible native fields, Base UI
avatars and deletion dialogs, and live status/error messages.

## Preview and validation

Run `pnpm dev` and visit `/en/customers`. Linked examples cover the directory,
`/en/customers/new`, `/en/customers/acme`, and its `/projects` and `/sync` sections.
The showroom controls demonstrate failures, loading/error states, action
visibility, and host slots. In-memory demo customer data survives client-side
navigation and resets on reload. Demo callbacks do not retain passwords or
change real accounts.

Run `pnpm test`, and with the showroom running, `pnpm test:browser` (set
`TEST_BASE_URL` for another port). Follow the contributor validation workflow
before publishing. Verify installation in a temporary shadcn consumer using
the local `@forge` namespace and typecheck the installed files. Updates copy
source; host adapters should stay outside the managed plugin directory.
