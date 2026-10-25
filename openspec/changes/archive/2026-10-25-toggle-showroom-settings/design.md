# Design

## Decisions

Keep visibility in ShowroomPreview. Read the 40rem media query through useSyncExternalStore after hydration, then initialize the frame’s visibility once: closed on phones, open on larger screens. Preserve that choice across resizes; toggling remains local state. PreviewControls places an icon-only gear beside its title and uses IconTooltip with the same Settings accessible name. The native hidden attribute removes panel content and its title from layout and keyboard navigation while preserving control state. The toggle remains mounted and focused when activated.

The existing header-only viewport budget stays intact. On desktop, the expanded panel occupies 18rem and the collapsed column shrinks to the gear button and padding. Expanded mobile settings remain in normal flow above the preview. Below 40rem, the collapsed gear floats beside the preview’s first row; normal flow lets a back link share its row and moves wider content below it without overlap. Full application previews clear the float so their own layouts retain the full viewport width. Tablet and desktop placement remain unchanged. Keep aria-expanded, aria-controls, a focus outline and a filled primary active state.

## Trade-offs

A collapsed panel retains only the space needed for its reopen button and padding. Visibility resets when the frame remounts; saved preferences are outside this request.
