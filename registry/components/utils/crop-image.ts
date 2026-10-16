export interface ImageCropSize {
  width: number;
  height: number;
}

export function validImageCropSize({ width, height }: ImageCropSize) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= 8192 &&
    height <= 8192 &&
    width * height <= 16_777_216
  );
}

/** Position is a fraction of the available travel, so the crop never leaves the image. */
export function imageCropRect(
  source: ImageCropSize,
  target: ImageCropSize,
  zoom = 1,
  x = 0.5,
  y = 0.5,
) {
  if (
    !validImageCropSize(target) ||
    !Number.isFinite(source.width) ||
    !Number.isFinite(source.height) ||
    source.width <= 0 ||
    source.height <= 0 ||
    ![zoom, x, y].every(Number.isFinite)
  )
    throw new Error("Invalid crop dimensions");
  const scale =
    Math.max(target.width / source.width, target.height / source.height) * Math.max(1, zoom);
  const width = Math.min(source.width, target.width / scale);
  const height = Math.min(source.height, target.height / scale);
  return {
    x: (source.width - width) * Math.max(0, Math.min(1, x)),
    y: (source.height - height) * Math.max(0, Math.min(1, y)),
    width,
    height,
  };
}

export async function exportImageCrop(
  image: HTMLImageElement,
  file: File,
  target: ImageCropSize,
  zoom: number,
  x: number,
  y: number,
): Promise<File> {
  const crop = imageCropRect(
    { width: image.naturalWidth, height: image.naturalHeight },
    target,
    zoom,
    x,
    y,
  );
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    target.width,
    target.height,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  // Browsers may silently fall back to PNG when the requested encoder is unavailable.
  if (!blob || blob.type !== "image/webp") throw new Error("WebP encoding unavailable");
  return new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "image"}.webp`, {
    type: blob.type,
  });
}
