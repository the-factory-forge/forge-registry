# Design

Reuse the existing dropdown, folder tree, EntryDialog, upload queue and trash confirmation. Keep the dialog outside the tree so refreshing or removing a row does not discard action feedback. File-picker destinations are captured per queued job.

Add optional prepareFolderUpload and duplicateEntry methods. Directory preparation validates paths and creates folders within the existing space lock and upload transaction. Existing reservation input JSON stores the path without a migration. Copies create independent entry metadata atomically and share immutable object keys; cleanup checks remaining references under the same space lock. This avoids downloading and re-uploading entire trees or introducing asynchronous copy jobs.

The browser entrypoint stays independent of server modules. The existing Base UI and Lucide dependencies supply the menu; the manifest ships folder-menu.tsx. Hosts forward the new operations explicitly and must upgrade every writer and maintenance worker before enabling duplication. Older cleanup code is unsafe after copies share object keys. The directory picker omits empty directories and batch cancellation retains completed files and created folders.

Recorded consumer Terminal60 requires reviewed adoption and new authenticated transport methods; its source is not changed here. Existing Menus image restrictions stay host-owned. No new plugin or public plugin-list entry is created.
