# Design

Reuse the existing nested navigation renderer and active-path helper. Keep the
intranet sidebar's public exports as aliases and preserve its account controls,
viewport layout and keyboard shortcut. The subpage sidebar owns only a local
column and a Base UI mobile drawer. Both sidebars use the same mobile hook and
semantic navigation styles. No auth dependency enters subpage navigation.

Drive keeps its breadcrumb and actions, with navigation below the breadcrumb
and beside the table. All files is a real host-routed link. Trash selects the
existing local view. Folder expansion calls the authorized `listEntries` adapter
one cursor page at a time; child requests start on expansion and abort when
unmounted. Folder links use the existing host adapter. Upload and trash state
remain in the existing Drive browser, outside the navigation renderer.

Registry dependencies own all shared files. A disposable shadcn consumer verifies
installation; existing websites are not updated by generating this output.

## Direction contract

THESIS: Keep subpage destinations visible beside the working content.

OWN-WORLD: Inherit Forge's sidebar tokens, compact type, rounded navigation rows,
Lucide icons, and the intranet sidebar's current-item treatment.

STORY: Open a page, expand folders, navigate to a folder or Trash, and return to files.

FIRST VIEWPORT: Breadcrumb above the local sidebar and content. File actions remain
above the table on the right; search stays inside its panel. Mobile replaces the
column with a labeled drawer trigger.

FORM: Extend the established sidebar design as requested. No identity change or concept seed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
