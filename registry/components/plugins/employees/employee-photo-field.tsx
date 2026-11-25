"use client";

import { UserRoundIcon } from "lucide-react";
import { useId, useState } from "react";

import { Image } from "@/components/image";
import { ImageCropDialog, type ImageCropLabels, type ImageCropSize } from "@/components/image-crop";
import { PhotoPicker } from "@/components/photo-picker";
import { cn } from "@/components/utils/cn";
import { storageFilename } from "@/components/utils/storage-filename";

export const employeePhotoLabels = {
  label: "Employee photo",
  /** @deprecated The photo picker no longer displays helper text. */
  hint: "",
  missing: "No photo",
  choose: "Photo",
  change: "Change photo",
};
export interface EmployeePhotoFieldProps {
  src?: string | null;
  onUpload: (file: File) => Promise<void>;
  dimensions?: ImageCropSize;
  labels?: Partial<typeof employeePhotoLabels>;
  cropLabels?: Partial<ImageCropLabels>;
  disabled?: boolean;
  className?: string;
}
/** Optional employee media; the host owns storage, validation and persistence. */
export function EmployeePhotoField({
  src,
  onUpload,
  dimensions = { width: 512, height: 512 },
  labels: overrides,
  cropLabels,
  disabled,
  className,
}: EmployeePhotoFieldProps) {
  const labels = { ...employeePhotoLabels, ...overrides };
  const id = `factory-employee-photo-${useId()}`;
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className={cn("grid gap-3", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {labels.label}
      </label>
      <PhotoPicker
        inputId={id}
        buttonLabel={src ? labels.change : labels.choose}
        disabled={disabled || !!file}
        onSelect={setFile}
        preview={
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {src ? (
              <Image
                src={src}
                alt={labels.label}
                width={80}
                height={80}
                className="size-full object-cover"
              />
            ) : (
              <>
                <UserRoundIcon aria-hidden="true" className="size-8 text-muted-foreground" />
                <span className="sr-only">{labels.missing}</span>
              </>
            )}
          </div>
        }
      />
      {file && (
        <ImageCropDialog
          file={file}
          {...dimensions}
          labels={cropLabels}
          onCancel={() => setFile(null)}
          onConfirm={async (cropped) => {
            await onUpload(
              new File([cropped], storageFilename(cropped.name, "employee", "webp"), {
                type: cropped.type,
              }),
            );
            setFile(null);
          }}
        />
      )}
    </div>
  );
}
