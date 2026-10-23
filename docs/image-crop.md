# Image crop

Install `@forge/image-crop` and open the [showroom example](https://registry.the-corner.io/image-crop).
This form helper stays out of the homepage directory and is also demonstrated in Blogs.

```tsx
import { ImageCropDialog } from "@/components/image-crop";

// The host stores the selected File and supplies its required output dimensions.
<ImageCropDialog
  file={selectedFile}
  width={1200}
  height={675}
  onCancel={() => setSelectedFile(null)}
  onConfirm={async (file) => {
    await upload(file);
    setSelectedFile(null);
  }}
/>;
```

Set `file` from a file input and clear the input's value so the same file can be
selected again. Keep the current image until confirmation succeeds. Close the
dialog by setting `file` to null; reject `onConfirm` on failure to retain the crop
and show retry feedback. A resolved callback means the host accepted the file.
The component does not send network requests or save files itself.

The preview uses the same source rectangle as the export. Drag to reposition or
use the labelled horizontal, vertical and zoom sliders with a keyboard. The
aspect ratio stays fixed; zoom ranges from 1× to 3×. Confirmation resizes to the
exact requested dimensions, including upscaling small sources, and encodes WebP
at quality 0.85. Output has a `.webp` filename and `image/webp` MIME type. Canvas
export flattens animation and discards source metadata; it may be larger than an
already optimized input. This is intended for static images, not original-file storage.

JPEG, PNG and WebP inputs are supported. `maxFileBytes` defaults to 10 MiB and
applies to both input and output. Decoded sources above 40 megapixels are rejected;
output dimensions must be positive integers, each at most 8192, with at most
16,777,216 pixels. Decode, encoding and callback errors never submit the original
file. A browser without WebP encoding reports an error instead of mislabelling PNG.
Hosts retain their server-side MIME, signature, size and authorization checks.

All copy is overridable through `labels: Partial<ImageCropLabels>`. Exported types
include `ImageCropDialogProps` and `ImageCropSize`. `className` styles the popup.
The Base UI dialog traps focus, supports Escape/cancel and restores focus. While
preparation or the host callback is pending, controls and dismissal are disabled.
Cmd/Ctrl+Enter confirms through the shared dialog shortcut. The item ships its
helpers, Base UI dependency and semantic Tailwind classes; the host owns theme values.

Installed copies remain unchanged until the consumer adopts new source.
Blogs crops covers by default; `imageDimensions` overrides output sizes or disables
cropping explicitly. Translate with `imageCropLabels`; see [integration](./blogs.md#crop-new-thumbnail-and-banner-uploads).
Review each site's recorded integration in the
[consumer inventory](https://github.com/the-factory-forge/forge-spec/blob/main/consumers/sites.yaml)
before updating it. Source adoption, output dimensions and deployment remain
separate consumer decisions.
