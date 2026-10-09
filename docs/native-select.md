# Native select

Install with `shadcn add @forge/native-select`. The item declares Lucide and
`@forge/cn`; it requires the host's existing semantic theme and Tailwind setup.

`NativeSelect` and `NativeSelectProps` wrap a native HTML select. Standard select
props, including children, refs, labels, form attributes, validation, values and
change handlers, pass through to the control. Apply existing field presentation
with `className`; the wrapper fills its container and can shrink on narrow screens.

Single-choice controls use a decorative 16px chevron inset 12px from the inline
end. A 40px end padding leaves room between selected text and the arrow. Positioning
follows the host's text direction. Disabled fields dim the arrow; forced-colors
mode restores the native indicator. Multiple selections and visible listboxes
retain native presentation without the decorative arrow.

The [showroom example](https://registry.the-corner.io/native-select) demonstrates
selection, long labels and disabled fields. The homepage lists it under Component.
Employees, Projects, Drive, Blogs, Menus and Reservations use the same item;
refresh their source installs to receive it. Existing deployed sites need their
own reviewed installation and deployment.
