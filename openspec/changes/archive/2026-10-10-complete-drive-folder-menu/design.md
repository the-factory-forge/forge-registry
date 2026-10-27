## Implementation

Reuse DriveFolderMenu, EntryDialog, the existing createFolder callback and download
toast. A menu creation targets its selected folder and only inserts an optimistic
row when the open folder is that destination.

Load fflate only for folder downloads. It is already a transitive dependency and
becomes an explicit pinned Drive dependency. Traverse all authorized listEntries
pages, preserve relative paths and empty folders, and fetch each getDownload URL
without cookies. CORS GET access is already in the companion configuration.
Validate names and repeated IDs/cursors, cap both declared and actual file bytes,
and abort reads when the browser unmounts. Limit browser ZIPs to 100 MB, 1,000
entries and 100 levels; larger server-streamed archives are outside this version.
The archive is not an atomic snapshot of concurrent edits.

Public client methods, storage authorization, schema and existing file downloads
remain compatible. Update the manifest and generated output, test clean shadcn
installation, and record Terminal60 adoption as pending.
