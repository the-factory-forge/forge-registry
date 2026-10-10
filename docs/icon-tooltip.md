# Icon tooltip

Install `@forge/icon-tooltip` for hover and keyboard hints on icon-only buttons
and action links. Each importing registry item declares it as a dependency.
Base UI is already used by Forge; consumers receive it through this item.

```tsx
import { IconTooltip } from "@/components/icon-tooltip";

<IconTooltip label={labels.edit}>
  <button type="button" aria-label={labels.edit} onClick={onEdit}>
    <PencilIcon aria-hidden="true" />
  </button>
</IconTooltip>;
```

Pass one existing control as `children` and its translated accessible name as
`label`. The control retains its styles, semantics, ref, focus and event handlers.
Custom link/button adapters must forward the ref and DOM props to their control.
No extra layout element or application provider is required. Omit `label` only
when a shared control renders visible action text instead of an icon-only action.

Tooltips open on pointer hover and keyboard focus, close with Escape or activation,
and use a portal to avoid clipping inside tables, dialogs and search fields.
They use host popover tokens and wrap long translations. Native `title` is not a
replacement. Keep `aria-label` or screen-reader text on the control, decorative
icons hidden, and disabled controls disabled. Touch users retain the accessible
name and normal activation without a required tooltip step.

The [showroom example](https://registry.the-corner.io/icon-tooltip) covers a button,
link, disabled action and dialog trigger/close controls. Existing plugin demos
cover translated edit/delete actions, password toggles, search and navigation.
Install updated items and review host adapters to adopt these tooltips in a site;
generating registry output does not update deployed consumers.
