# Design

Sort the final choices in `getMenuFilterLabels` with the native `Intl.Collator`
for the current locale and base sensitivity, ignoring case and accent differences.
Use stable IDs to break name ties. The public page already separates allergen and
dietary groups, so each group follows the alphabetic sequence. Sort a new array
without changing item labels, catalog positions or meal-category navigation.

Keep existing helper and prop signatures. Overrides and custom labels remain
subject to visible-item assignment and now use alphabetical ordering. The full
staff catalog and its stored order are unchanged. This is an intentional change
to the previous supplied-order behavior and needs a source refresh, no migration.

Extend the existing browser journey to assert English and French group order.
Add one helper check for translated names, accents, custom IDs, supplied-order
independence and preservation of item-label order. Run repository checks, rebuild
distribution and compile an official disposable consumer installation.
