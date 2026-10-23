# Plugin contracts and UI alignment

Use the current registry manifest, exported types and integration guides to define
Auth, Employees, Customers, Projects, Drive, Blogs, Menus and Reservations. Keep
one Plugins capability with module requirements and link the deeper Reservations
contract. Server companions are part of their parent feature, not new user-facing
plugins. Hosts still own routing, authorization, translations and transport.

Reuse existing button classes and primitives for pointer/disabled states. Keep
status mappings independent of brand colors, place detail badges opposite titles,
use semantic validation colors, and add the existing Lucide action icons where
missing. Preserve public APIs, confirmation behavior and keyboard interaction.
Ship utilities in component source, including primitives used outside plugins;
do not rely on the showroom's global CSS for consumer correctness.

Verify representative dialogs, status headers, translated labels, narrow screens
and both themes. Run existing browser/unit suites, formatting/lint/type/build
checks, regenerate items and install changed items in a disposable consumer.
Server behavior is unchanged, so no database migration or storage rewrite is
required. Update documentation where new semantic status pairs are consumed.

## Archive reconciliation

These requirements were synchronized into the current spec and subsequently
updated. Their obsolete `ADDED` operations are omitted from this archive delta;
the current requirements and all their scenarios remain authoritative:

- [Consistent plugin presentation](../../specs/plugins/spec.md#requirement-consistent-plugin-presentation)
- [Auth plugin](../../specs/plugins/spec.md#requirement-auth-plugin)
- [Employees plugin](../../specs/plugins/spec.md#requirement-employees-plugin)
- [Customers plugin](../../specs/plugins/spec.md#requirement-customers-plugin)
- [Projects plugin](../../specs/plugins/spec.md#requirement-projects-plugin)
- [Drive plugin](../../specs/plugins/spec.md#requirement-drive-plugin)
- [Blogs plugin](../../specs/plugins/spec.md#requirement-blogs-plugin)
- [Menus plugin](../../specs/plugins/spec.md#requirement-menus-plugin)
- [Reservations plugin](../../specs/plugins/spec.md#requirement-reservations-plugin)

The remaining delta blocks already match the current spec. Archiving this change
must leave the current spec unchanged. The implementation and verification notes
above describe the original delivery; later changes retain their own ownership.
