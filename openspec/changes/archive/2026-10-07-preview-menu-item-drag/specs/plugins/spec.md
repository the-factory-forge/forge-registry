## ADDED Requirements

### Requirement: Menu item drag feedback

While staff drag a menu item, the item table SHALL show a floating preview with
the supplied item name and category, distinguish the source row and mark the
exact insertion edge above or below the hovered row. The saved order SHALL
match that preview. Feedback SHALL support mouse and touch, both themes and
narrow screens, without intercepting pointer hit testing or adding duplicate
accessible controls. Rows SHALL retain their saved order until a drop saves it.
Escape, pointer cancellation, or dropping on the source or outside the table
SHALL clear feedback without saving. Keyboard Up/Down reordering and
existing pending, search and failure behavior SHALL remain available.

#### Scenario: Previewing an insertion

- **WHEN** staff drag an item over the top or bottom half of another row
- **THEN** a floating item preview and insertion line show the proposed move
- **AND** dropping saves the item at that position without changing its category

#### Scenario: Canceling a previewed move

- **WHEN** staff press Escape, the pointer is canceled, or they drop on the source or outside the table
- **THEN** the drag preview and insertion line disappear
- **AND** no reorder is saved and the original row order remains
