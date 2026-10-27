## Implementation

Attach one shared key handler to existing dialog popups in Drive, Employees,
Menus and Reservations. It clicks the form's existing submit button so native
validation and the current save flow remain authoritative. Ignore disabled
buttons, held keys, text composition, handled events and events from portals
outside the popup. Ordinary Enter keeps its current behavior.

Drive's delete dialog opts out. Other destructive dialogs contain no submit
form. Page editors and selection dialogs are unchanged. No runtime dependency,
new UI component or host API is needed. Declare the shared utility dependency
on each affected registry item and test a clean shadcn installation.

## Verification

Exercise both shortcuts, required fields, disabled buttons, failed saves and
destructive exclusions. Run the existing repository checks, rebuild distribution,
verify the affected showroom flows and validate this shared contract.
