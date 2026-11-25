"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { Image } from "@/components/image";
import { PhotoPicker } from "@/components/photo-picker";
import {
  maxProductPhotos,
  productImageSource,
  type ProductMedia,
  type ProductPhoto,
} from "@/components/plugins/products/model";
import { productButtonClass, productsLabels } from "@/components/plugins/products/presentation";
import { cn } from "@/components/utils/cn";
import { destructiveActionClass } from "@/components/utils/destructive-action";
import type { useEditorValidation } from "@/components/utils/editor-form";

type Labels = typeof productsLabels;
type ImageUrl = (src: string) => string;
type Slot = "banner" | "thumbnail" | number;
const emptyPhoto = { src: "", alt: "" };

export function ProductMediaFields({
  media,
  onChange,
  uploadImage,
  imageUrl,
  onUploading,
  labels,
  prefix,
  inputClass,
  validation,
}: {
  media: ProductMedia;
  onChange: (media: ProductMedia) => void;
  uploadImage?: (file: File) => Promise<string>;
  imageUrl?: ImageUrl;
  onUploading: (busy: boolean) => void;
  labels: Labels;
  prefix: string;
  inputClass: string;
  validation: ReturnType<typeof useEditorValidation>;
}) {
  const [busy, setBusy] = useState<Slot>();
  const [failure, setFailure] = useState<{ slot: Slot; message: string }>();
  const gallery = media.gallery ?? [];
  function change(slot: Slot, photo?: ProductPhoto) {
    setFailure(undefined);
    if (typeof slot !== "number") {
      onChange({ ...media, [slot]: photo });
    } else {
      const next = gallery.slice();
      if (photo) next[slot] = photo;
      else next.splice(slot, 1);
      onChange({ ...media, gallery: next });
    }
  }
  async function upload(file: File, slot: Slot) {
    if (!uploadImage || busy !== undefined) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setFailure({ slot, message: labels.imageFileError });
      return;
    }
    setBusy(slot);
    setFailure(undefined);
    onUploading(true);
    try {
      const src = productImageSource.parse(await uploadImage(file));
      change(slot, { src, alt: "" });
    } catch {
      setFailure({ slot, message: labels.uploadError });
    } finally {
      setBusy(undefined);
      onUploading(false);
    }
  }
  function status(slot: Slot) {
    if (busy === slot)
      return <output className="text-sm text-muted-foreground">{labels.uploading}</output>;
    if (failure?.slot === slot)
      return (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      );
  }
  function field(slot: Slot, title: string, photo?: ProductPhoto) {
    const id = `${prefix}-photo-${slot}`;
    const validSrc = productImageSource.safeParse(photo?.src);
    const preview = validSrc.success && (
      <Image
        src={imageUrl?.(validSrc.data) ?? validSrc.data}
        alt=""
        width={160}
        height={108}
        className="h-16 w-24 shrink-0 rounded-md object-cover"
      />
    );
    return (
      <fieldset key={slot} className="min-w-0 space-y-2">
        <legend className="mb-1 text-sm font-medium">{title}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {uploadImage ? (
            <PhotoPicker
              preview={preview}
              inputLabel={title}
              buttonLabel={labels.choosePhoto}
              buttonAriaLabel={`${labels.choosePhoto} — ${title}`}
              onSelect={(file) => void upload(file, slot)}
            />
          ) : (
            <>
              {preview}
              <label className="min-w-0 flex-1 text-sm">
                {labels.imageUrl}
                <input
                  {...validation.field(id)}
                  className={inputClass}
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={2048}
                  value={photo?.src ?? ""}
                  onChange={(e) => {
                    change(slot, { ...emptyPhoto, ...photo, src: e.target.value });
                    validation.clear(id);
                  }}
                />
                {validation.message(id)}
              </label>
            </>
          )}
          {(photo?.src || typeof slot === "number") && (
            <IconTooltip label={labels.removePhoto}>
              <button
                type="button"
                className={cn(productButtonClass, destructiveActionClass)}
                aria-label={`${labels.removePhoto} — ${title}`}
                onClick={() => change(slot)}
              >
                <Trash2Icon aria-hidden="true" />
              </button>
            </IconTooltip>
          )}
        </div>
        {photo?.src && (
          <label className="grid gap-1 text-sm">
            {labels.imageAlt}
            <input
              className={inputClass}
              maxLength={500}
              value={photo.alt}
              onChange={(e) => change(slot, { ...photo, alt: e.target.value })}
            />
          </label>
        )}
        {status(slot)}
      </fieldset>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 @md:grid-cols-2">
        {field("banner", labels.banner, media.banner)}
        {field("thumbnail", labels.thumbnail, media.thumbnail)}
      </div>
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-1 font-medium">{labels.gallery}</legend>
        {gallery.map((photo, index) => field(index, labels.photo(index + 1), photo))}
        {gallery.length < maxProductPhotos &&
          (uploadImage ? (
            <PhotoPicker
              preview={null}
              inputLabel={labels.addPhoto}
              buttonLabel={labels.addPhoto}
              onSelect={(file) => void upload(file, gallery.length)}
            />
          ) : (
            <button
              type="button"
              className={productButtonClass}
              onClick={() => change(gallery.length, emptyPhoto)}
            >
              <PlusIcon aria-hidden="true" />
              {labels.addPhoto}
            </button>
          ))}
        {status(gallery.length)}
      </fieldset>
    </div>
  );
}

export function ProductGallery({
  photos,
  imageUrl,
  labels,
  name,
}: {
  photos: readonly ProductPhoto[];
  imageUrl?: ImageUrl;
  labels: Labels;
  name: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const index = Math.min(active, photos.length - 1);
  function move(step: number) {
    const element = track.current;
    if (!element) return;
    const target = element.children[(index + step + photos.length) % photos.length];
    const distance = target.getBoundingClientRect().left - element.getBoundingClientRect().left;
    element.scrollBy({ left: distance, behavior: "instant" });
  }
  return (
    <section aria-label={labels.gallery} className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{labels.gallery}</h2>
        {photos.length > 1 && (
          <div className="flex items-center gap-2">
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-muted-foreground tabular-nums"
            >
              {labels.photoPosition(index + 1, photos.length)}
            </span>
            {([-1, 1] as const).map((step) => {
              const label = step < 0 ? labels.previousPhoto : labels.nextPhoto;
              const Icon = step < 0 ? ChevronLeftIcon : ChevronRightIcon;
              return (
                <IconTooltip key={step} label={label}>
                  <button
                    type="button"
                    className={productButtonClass}
                    aria-label={label}
                    onClick={() => move(step)}
                  >
                    <Icon aria-hidden="true" className="rtl:rotate-180" />
                  </button>
                </IconTooltip>
              );
            })}
          </div>
        )}
      </div>
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl bg-muted"
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          if (clientWidth) setActive(Math.round(Math.abs(scrollLeft) / clientWidth));
        }}
      >
        {photos.map((photo, i) => (
          <Image
            key={i}
            src={imageUrl?.(photo.src) ?? photo.src}
            alt={photo.alt || `${name} — ${labels.photo(i + 1)}`}
            width={1080}
            height={720}
            className="aspect-3/2 w-full shrink-0 snap-start object-contain"
          />
        ))}
      </div>
    </section>
  );
}
