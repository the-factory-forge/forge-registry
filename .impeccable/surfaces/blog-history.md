# Blog history

Mode: Operate. Targets: `registry/components/plugins/blogs/admin.tsx` and `history.tsx`.

## Direction contract

THESIS: Inspect a saved language state and understand exactly which reprise it belongs to before changing live content.

OWN-WORLD: Extend Forge's existing compact controls, semantic light/dark tokens, bordered panels and typography. Keep status colors and ordinary editing intact.

STORY: Open history, choose a read-only version, compare it with the live publication, then resume or publish with an explicit removal plan. Signature and saving actor stay distinct.

FIRST VIEWPORT: Working content occupies the left column and a 22rem timeline sits on the right at desktop widths. Mobile opens history above the content and selection returns focus to the selected state. No committed number is assigned to unsaved work.

FORM: Existing editor extension approved through the saved OpenSpec mockup. Each reprise keeps its own lane. The selected path paints last with a 3px stroke and background separation at crossings; inactive paths use 1px. Unified diff rows remain subtle, with stronger backgrounds on changed words. No decorative motion or new imagery.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## References

The owning proposal and behavioral mockup are in sibling `forge-spec-blog-history/openspec/changes/add-blog-history/`. DESIGN.md and the existing Registry UI control production styling. No global design-system change is requested. The pre-existing sidecar drift must not be repaired as part of this extension.
