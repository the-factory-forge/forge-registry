## Purpose

Let visitors inspect complete photographs and browse a host-supplied collection without repeatedly closing the image dialog.

## ADDED Requirements

### Requirement: Compatible image enlargement

Lightbox SHALL preserve existing single-image callers and custom thumbnail content. Its dialog SHALL render above transformed ancestors, contain keyboard focus, expose an accessible close control and complete image, close with Escape and restore focus to the trigger. Image failure SHALL leave close and navigation controls usable.

#### Scenario: Open an existing single photo

- **WHEN** a caller supplies the existing single-image props
- **THEN** activating the thumbnail shows the complete image with its alternative text
- **AND** no collection controls are required and closing restores the original trigger

### Requirement: Host-owned collection navigation

Lightbox SHALL accept an ordered image collection and selected image from the host. Previous/next controls, horizontal swipe and left/right arrow keys SHALL change the active image without closing. Current position and accessible text SHALL follow the image. The host SHALL own collection filtering, metadata and localized labels.

#### Scenario: Traverse a filtered collection

- **WHEN** the host supplies a filtered three-image collection and opens its second image
- **THEN** next and previous show only those supplied images in order
- **AND** the dialog announces its current position and displays the active image's caption when supplied
- **AND** a one-image collection omits redundant navigation controls

#### Scenario: Swipe or use the keyboard

- **WHEN** a visitor performs a horizontal swipe or presses an arrow key inside the open dialog
- **THEN** the active image changes once in the intended direction
- **AND** vertical gestures do not navigate, focus stays in the dialog and Escape still closes it

#### Scenario: Collection changes or an image fails

- **WHEN** a host removes the active image or supplies an empty collection
- **THEN** the viewer selects an available image or closes safely rather than reading an invalid index
- **WHEN** an image fails to load
- **THEN** the visitor can still navigate or close without a trapped blank overlay
