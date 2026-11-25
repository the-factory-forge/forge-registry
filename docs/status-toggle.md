# Status toggle

Install with `shadcn add @forge/status-toggle` and import `StatusToggle` from
`@/components/status-toggle`.

Use `StatusToggle` for a binary status action such as website visibility.
Give the button a stable, translated `label` and display the current status in
its children. Pass the current value as `pressed` and handle the next value
in `onPressedChange`. Set `disabled` while an update is pending.

```tsx
<StatusToggle
  label={labels.website}
  pressed={visible}
  onPressedChange={setVisible}
  disabled={saving}
  className={
    visible
      ? "bg-status-success text-status-success-foreground"
      : "bg-status-not-started text-status-not-started-foreground"
  }
>
  {visible ? labels.websiteVisible : labels.websiteHidden}
</StatusToggle>
```

The [Employees showroom](https://registry.the-corner.swiss/en/employees) demonstrates the toggle in the edit
dialog. The [Blogs showroom](https://registry.the-corner.swiss/en/blogs) uses it in the article editor.
