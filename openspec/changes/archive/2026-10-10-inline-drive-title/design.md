## Implementation

Use a Drive-specific title editor in the existing distributed ui.tsx. Keep the title's footprint while editing, reuse validName and existing optimistic mutations, lock pending submissions, and report failures through the shared toast renderer. Keep the failed draft in the input. Remove the unused breadcrumb-only menu branch from EntryDialog; sidebar and row dialogs keep their existing behavior. No dependencies or manifest paths change.

## Compatibility and checks

Folder renaming still requires the rename capability. Root renaming still requires onRenameSpace and host authorization. Ancestor links and read-only titles remain unchanged. Cover keyboard activation, selection, cancellation, unchanged and invalid names, failed-save retry, blur saves, duplicate submission, IME input, nested navigation and mobile/desktop geometry in both themes. Rebuild the official registry output and run repository checks.
