# Drive folder actions

## Why

The folder tree currently requires users to navigate before uploading or managing a folder. The requested first version adds the red-marked actions from the supplied reference.

## What changes

- Add a folder menu with uploads, rename, duplication and confirmed trash.
- Add optional directory-upload and duplication operations to Drive and its storage companion.
- Preserve legacy adapters, authorization, immutable data and retry controls.

## Impact

The owning OpenSpec root is forge-spec. Implementation and generated items belong to forge-registry. Drive, drive-storage and dependent Menus items are affected. Terminal60 is the recorded consumer; its source refresh and transport changes remain a separate follow-up. Forge-template has no recorded Drive installation. These are ordinary reusable file-browser capabilities; host records, sharing, editors and organization management remain outside scope.
