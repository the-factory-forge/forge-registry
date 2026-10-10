# Registry context

Reusable source lives under `registry/components/`; the showroom is under `src/`.
`registry/registry.json` owns the install manifest. Rebuild `public/r/` with
`pnpm registry:sync`; consumer sites receive changes through reviewed shadcn installs.

## Showroom card links

The arrow after each homepage card's "Open" label moves slightly to the right
when the card is hovered or focused, then returns when the interaction ends.
Keep the label and layout still, preserve visible keyboard focus, and hide the
decorative arrow from assistive technology. Respect reduced-motion preferences
by keeping the arrow still.

## Public blog categories

On narrow screens, place Categories above the posts in a compact disclosure that
starts closed and supports keyboard opening and closing. On desktop, keep the
categories expanded in the right sidebar.

Distinguish main categories with semibold foreground text. Indent child categories,
use muted text, and add a vertical border as a hierarchy guide. Highlight the
selected category with the primary color at either level, including the child's
guide. Preserve translated labels, post counts, filtering, and visible keyboard
focus in both themes. See the [Blogs guide](./docs/blogs.md#public-pages-and-images).

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

## Admin controls

The implemented registry components are the design reference. Plugin action buttons
use compact rounded corners, 32px desktop minimums and 40px mobile targets; delete
actions use a tinted destructive surface. Status labels retain their semantic color
pairs and readable text, with a small decorative dot. The existing sidebar, shell,
showroom layout, and page/card spacing are unchanged.
