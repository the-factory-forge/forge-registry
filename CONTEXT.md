# Registry context

Reusable source lives under `registry/components/`; the showroom is under `src/`.
`registry/registry.json` owns the install manifest. Rebuild `public/r/` with
`pnpm registry:sync`; consumer sites receive changes through reviewed shadcn installs.

## DOM IDs

Every DOM ID authored by registry or showroom code must start with `factory-`.
Use descriptive fixed IDs for singleton elements, such as `factory-cookie-banner`.
Use a prefixed React instance ID for reusable fields and sections:

```tsx
const id = `factory-customer-form-${useId()}`;
```

Keep `htmlFor`, ARIA references, fragment links, CSS selectors, and tests aligned
with the resulting IDs. Host adapters supplying a DOM ID to a transparent shim or
field component must also use this prefix; supplied values pass through unchanged.
Database/entity IDs, provider tracking IDs, and IDs generated internally by third-party
libraries retain their own contracts. The shared rule lives in forge-spec's
[Shared UI contract](https://github.com/the-factory-forge/forge-spec/blob/main/openspec/specs/shared-ui/spec.md).

The website screenshot CLI hides `#factory-cookie-banner` only during capture,
without accepting cookies or changing saved consent. Render one cookie banner per
page. Existing consumer sites must refresh the component and redeploy to receive
renamed IDs; their custom selectors must be updated alongside that refresh.
