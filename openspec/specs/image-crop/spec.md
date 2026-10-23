# image-crop Specification

## Purpose

Prepare image uploads through an accessible crop confirmation flow, preserving host control of dimensions and recovery from upload failures.

## Requirements

### Requirement: Confirm a crop before uploading

For a new image with host-supplied output dimensions, the UI SHALL require crop
confirmation before invoking the host upload callback. It SHALL support keyboard
and pointer adjustment at the fixed target ratio and preserve the current image
on cancellation.

#### Scenario: Confirming a prepared image

- **WHEN** an editor confirms the crop
- **THEN** the callback receives a WebP File with the requested pixel dimensions
- **AND** its extension and MIME type match its encoded bytes

#### Scenario: Canceling selection

- **WHEN** an editor cancels or dismisses the crop before confirmation
- **THEN** no upload callback runs and the previous image stays selected

### Requirement: Preserve failure recovery

The crop dialog SHALL validate input type, bytes and output dimensions, reject
decode/encoding failures, and keep the crop available after a failed host callback.
It SHALL prevent repeated submission and dismissal during pending work.

#### Scenario: Encoding or upload fails

- **WHEN** WebP encoding or the host callback fails
- **THEN** the dialog shows an accessible error and allows retry or cancellation
- **AND** it never submits the original file as a fallback

### Requirement: Optional blog image dimensions

Blogs SHALL crop new thumbnail and banner uploads by default, with host overrides
for dimensions, translated crop labels and an option to disable cropping without
changing its existing client or storage APIs.

#### Scenario: Default cover dimensions

- **WHEN** the host omits `imageDimensions`
- **THEN** thumbnails are cropped to 1200 × 900 and banners to 1600 × 900 before upload

#### Scenario: Dimensions are configured

- **WHEN** an editor selects a new image for a configured field
- **THEN** crop confirmation occurs before `client.upload`

#### Scenario: Dimensions are unknown

- **WHEN** the host disables cropping, leaves a field unconfigured in its dimensions override, or uploads an inline Markdown image
- **THEN** the existing upload path remains unchanged
