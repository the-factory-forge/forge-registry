"use client";

import { UserRoundIcon } from "lucide-react";
import { useId, useState } from "react";

import { Image } from "@/components/image";
import { ImageCropDialog, type ImageCropLabels, type ImageCropSize } from "@/components/image-crop";
import { cn } from "@/components/utils/cn";

export const employeePhotoLabels = {
  label: "Employee photo",
  hint: "Optional. Choose an image to crop and optimize before uploading.",
  missing: "No photo",
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
      <div className="flex size-28 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {src ? (
          <Image
            src={src}
            alt={labels.label}
            width={112}
            height={112}
            className="size-full object-cover"
          />
        ) : (
          <>
            <UserRoundIcon aria-hidden="true" className="size-12 text-muted-foreground" />
            <span className="sr-only">{labels.missing}</span>
          </>
        )}
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {labels.hint}
      </p>
      <input
        id={id}
        aria-describedby={`${id}-hint`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || !!file}
        className="w-full min-w-0 text-sm"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {file && (
        <ImageCropDialog
          file={file}
          {...dimensions}
          labels={cropLabels}
          onCancel={() => setFile(null)}
          onConfirm={async (cropped) => {
            await onUpload(cropped);
            setFile(null);
          }}
        />
      )}
    </div>
  );
}
