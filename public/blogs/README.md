# Blog illustrations

Generated with the built-in imagegen tool from the user's selected crops. Style references came from the welcome illustrations in tc-website and the mascot and partnership artwork in tc-assets.

These assets are showroom content. Consumers supply their own blog images. The preview contains the illustrations within their image boxes and inverts them in dark mode. Uploaded images retain their original rendering.

| File                  | Use                                                |
| --------------------- | -------------------------------------------------- |
| studio-1.png          | Ideas thumbnail and inline illustration, lightbulb |
| studio-2.png          | Productivity thumbnail, coffee mug                 |
| studio-3.png          | Workbench thumbnail, rounded-leaf plant            |
| studio-pencils.png    | Ideas banner, pencil cup                           |
| studio-lamp.png       | Productivity banner, desk lamp                     |
| studio-tall-plant.png | Workbench banner, pointed-leaf plant               |

## Generation prompts

Each image used its corresponding cropped object as the edit reference, an opaque background, and this shared prompt followed by its selected-object line.

```text
Use case: precise-object-edit.
Asset type: individual blog illustration in The Corner's hand-drawn black ink style.
Edit the supplied cropped reference into a clean, high-resolution standalone illustration on a pure white opaque background. Preserve the object's exact recognizable design, pose, silhouette, irregular black sketch outlines and dry brush texture from the reference. Reconstruct any clipped bits of the selected object, but do not redesign it.
Remove all surrounding objects, people, hands, table lines, partial marks at the edges and unrelated stars. Only the specified single object remains. Keep the object's own tiny grounding strokes beneath its base where appropriate.
Landscape 4:3 canvas, object centered horizontally and vertically, complete and uncropped, occupying about 55% of canvas height with very generous white margins. This will also be cropped to a wide blog banner. No lettering, no logo, no watermark, no gradients, no color, no extra props, no frame. White background to the edges.
```

- `studio-1.png`: Selected object: The large lightbulb with its looped filament and hand-drawn radiating light strokes.
- `studio-2.png`: Selected object: The small coffee mug with its handle on the left and dark coffee visible in the rim.
- `studio-3.png`: Selected object: The small potted plant with rounded oval black ink leaves in its little tapered white pot.
- `studio-pencils.png`: Selected object: The tapered white pencil cup containing four sketching pencils or brushes.
- `studio-lamp.png`: Selected object: The articulated black ink desk lamp, with its cone shade pointed down to the left, hinged arm and round base.
- `studio-tall-plant.png`: Selected object: The tall potted plant with slender pointed leaves, light interior hatching and a tapered white pot.
