# Blog history

Mode: Operate. Targets: `registry/components/plugins/blogs/admin.tsx` and `history.tsx`.

## Direction contract

THESIS: Inspect and compare retained publications, then resume one into the single draft before changing live content.

OWN-WORLD: Extend Forge's existing compact controls, semantic light/dark tokens, bordered panels and typography. Keep status colors and ordinary editing intact.

STORY: Open history, choose a read-only version, compare it with the live publication, then resume, save and publish with confirmation when a draft will be replaced. The oldest publication is pruned automatically at the limit. Signature and saving actor stay distinct.

FIRST VIEWPORT: Working content occupies the left column and a 22rem timeline sits on the right at desktop widths. Mobile opens history above the content and selection returns focus to the selected state. Drafts are labeled in the active language without a version number. Publication numbers advance only when publishing a new draft.

FORM: Existing editor extension approved through the saved OpenSpec mockup. A chronological list contains up to five publications and one draft. Selection and live/draft status stay explicit; no lanes or branch geometry. Read and Compare remain explicit mode controls. The comparison heading names live and selected endpoints, using the same red − / green + treatments as removed/added metadata and Markdown rows. Unchanged metadata stays hidden with a visible explanation. Unified diff rows remain subtle, with stronger backgrounds on changed words. No decorative motion or new imagery.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## References

The owning change is `openspec/changes/simplify-blog-history/`. DESIGN.md and the existing Registry UI control production styling. No global design-system change is requested. The pre-existing sidecar drift must not be repaired as part of this extension.

## Finish evidence

The original lane-based interface was reviewed on 2026-10-26. Its screenshots do
not validate the simplified list. The simplified list was inspected at 1440 and 390 pixels in both themes on
2026-10-28, along with the replacement dialog at both widths. Six retained rows
fit without horizontal overflow. Keyboard selection, action menus and comparison
passed the history browser suite. No new visual defect required a correction. Existing
sidecar drift remains outside this change.

The owner's follow-up 14–17 was inspected in four additional comparison captures
at 1440/390 pixels in both themes. Both endpoints, the Read/Compare controls and
changed title/slug/summary remain readable without horizontal overflow. Draft
labels are translated and have no visible number. No global styling changed.

The color follow-up was inspected in a single batch at 1440/390 pixels in both
themes. Endpoints and changed fields use the same red − / green + treatments as
Markdown. A 110-character slug wraps without horizontal overflow. Endpoint text
contrast ranges from 6.48:1 in light mode to 10.73:1 in dark mode. No visual
correction round was needed; no global tokens, imagery or sidecar data changed.

Every comparison block retains a visible field label. Markdown uses its own
visible heading and accessible section name, aligned with the other field labels.
Desktop/mobile checks in both themes and a scroll confirmation verified its
readability without overflow. No product correction round was needed.
