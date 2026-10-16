## Design

Use Base UI Dialog and canvas rather than adding a crop dependency. The preview
and export share source-rectangle math. Native labelled range controls provide
keyboard access alongside pointer dragging. Preserve the existing semantic colors,
compact actions, popup geometry and shared keyboard submission shortcut.

The host owns the File and target dimensions, closes after accepting the prepared
File, and rejects on upload errors. Loading, preparation and callback errors stay
inside the dialog; cancellation never invokes the upload callback. Export uses
exact output dimensions, WebP quality 0.85, a matching MIME type and extension.
Check the actual blob MIME because unsupported encoders may return PNG. Release
object URLs on file replacement/unmount and ignore stale image load callbacks.

Bound input bytes, decoded pixels and output dimensions. The same upload byte
limit applies to the result. Hosts retain server validation and authorization.
Upscaling is permitted to meet exact dimensions; static canvas output flattens
animation and drops metadata. Neither file size reduction nor original preservation
is promised.

Blogs adds optional `imageDimensions` for thumbnail/banner and `imageCropLabels`.
The upload callback and storage types do not change. Unconfigured uploads, inline
Markdown and selecting existing assets keep their current behavior. Drive remains
a general file store. Showroom crop sizes are illustrative host choices only:
both thumbnail and banner uploads open the cropper at 1200 × 675 by default.
Its settings can disable cropping to demonstrate a host without known dimensions.

Ship the component and geometry/export helper with Base UI, cn and dialog-submit.
No framework imports, host assets, global crop CSS or new package dependencies.
The helper demo is linked from documentation and the existing Blogs example,
without a basic-control homepage card. Verify a disposable shadcn installation.
