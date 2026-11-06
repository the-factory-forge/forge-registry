# Section anchor

Install `@forge/section-anchor` with shadcn. Try the showroom example at `/section-anchor`.

```tsx
import { SectionAnchor } from "@/components/section-anchor";

<h2>
  <SectionAnchor id="factory-personal-information">Personal information</SectionAnchor>
</h2>;
```

The title is a native link: clicking it or pressing Enter scrolls to the title and
updates the URL fragment, preserving the path and query. Links can be copied or
opened in another tab using the browser. Reloading or sharing the URL restores
the section, including sections mounted after data loads. Back/Forward retains
native fragment navigation and the host’s scroll-restoration policy. No router, clipboard, toast or provider is required.

Supply a unique, stable `factory-` ID per section, independent of translated text.
Keep heading semantics in the parent. `children` supplies the visible label and
`className` can adjust the default `scroll-mt-20` offset for the host's sticky header.
The component does not open collapsed panels or load missing sections; the host
must render the target. Missing and malformed fragments are ignored. Mount-time
scrolling is immediate and does not animate.

TC adopts the component at `src/components/forge/section-anchor.tsx`, with its
existing `cn` import. Its `AnchoredCardTitle` retains local copy feedback and
existing unprefixed profile IDs for URL compatibility. HR fields and permissions
remain in TC; this standalone item does not install the Employees plugin.

For hosts with router scroll restoration, restore explicit title links after the
router renders so a saved position cannot override a shared URL. TC and the
showroom use this TanStack adapter in `getRouter()`:

```tsx
router.subscribe("onRendered", () => {
  requestAnimationFrame(() => {
    const section = document.querySelector(
      `a[data-section-anchor][href="${CSS.escape(window.location.hash)}"]`,
    );
    section?.scrollIntoView({ block: "start", behavior: "instant" });
  });
});
```

This affects only marked section links; other pages retain the router's normal
scroll restoration. Hosts with another router can use its render-complete event.
