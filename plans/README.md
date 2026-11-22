# Implementation plans

| Plan                                                                    | Priority | Effort | Risk | Depends on | Status |
| ----------------------------------------------------------------------- | -------- | ------ | ---- | ---------- | ------ |
| [001 · Shorten labels beside action icons](./001-icon-action-labels.md) | P2       | M      | Low  | None       | DONE   |

The audit covered visible icon-and-text controls in the registry plugins, shared components and showroom at `4ce2936` on 2026-11-22. The three groups below implement one copy change. Customer checkouts and backend workflows were outside the audit.

| Order | Finding                                                        | Impact                                                                             | Confidence |
| ----- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| 1     | The Blog posts toolbar says “Manage categories” beside a gear. | Use the translated destination already shown on the Categories page.               | High       |
| 2     | Five plus buttons repeat “Add” or “New” before the object.     | Shorten the visible captions while keeping the action available to screen readers. | High       |
| 3     | Return links repeat “Back to” beside a left arrow.             | Show the destination, including the customer-specific Projects route.              | High       |

## Considered and rejected

- The editor pencils use “Manage categories” and “Manage labels” for their accessible names and keyboard tooltips. Neither has a visible verb to remove.
- “Create” and “Invite” are already the entire visible caption. They follow the primary-action convention in `DESIGN.md`.
- In Drive, “Upload folder” and “Folder” perform different operations. In Menus, creating a category and attaching an existing category are different choices. Their wording distinguishes the outcomes.
- Text-only links such as “Manage posts” supply the action themselves. The directory card’s “Open” call to action is part of its documented design.
