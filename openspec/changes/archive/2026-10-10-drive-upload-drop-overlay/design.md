## Design

Keep the table in place and position a non-interactive overlay within its panel.
Use existing semantic colors, a dashed outline and the existing Upload icon.
Expose the short instruction through Drive labels. Track nested drag entries so
moving between rows does not flicker; clear feedback when the drag ends or uploads
become unavailable. Only file drags activate the overlay.

Keep validation and queue operations in the existing drop handler. The file
picker remains the keyboard and touch alternative. Verify actual browser drag
events, cancellation, capability/loading guards and both themes at narrow and
wide widths. This follows the existing portable UI and host theme boundaries.
