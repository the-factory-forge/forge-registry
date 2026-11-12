"use client";

import { XIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";

import { useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { NativeSelect } from "@/components/native-select";
import type { SupportsLabels } from "@/components/plugins/supports/labels";
import {
  SUPPORT_IMAGE_TYPES,
  SUPPORT_MAX_IMAGES,
  SUPPORT_MAX_IMAGE_BYTES,
  supportCreateSchema,
  supportCommentSchema,
} from "@/components/plugins/supports/schema";
import type {
  SupportsClient,
  SupportTicket,
  SupportType,
} from "@/components/plugins/supports/types";
import {
  buttonClass,
  primaryClass,
  inputClass,
  supportError,
} from "@/components/plugins/supports/ui";
import { cn } from "@/components/utils/cn";
import { submitFormOnShortcut } from "@/components/utils/dialog-submit";
import { editorActionsClass } from "@/components/utils/editor-form";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

type SelectedFile = { file: File; requestId: string; url: string; attachmentId?: string };
export function SupportComposer({
  client,
  ticketId,
  labels,
  onCreated,
  onChanged,
  onPendingChange,
  onCancel,
  children,
  actions,
}: {
  client: SupportsClient;
  ticketId?: string;
  labels: SupportsLabels;
  onCreated?: (ticket: SupportTicket) => void;
  onChanged?: () => void;
  onPendingChange?: (pending: boolean) => void;
  onCancel?: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const id = `factory-support-composer-${useId()}`;
  const toast = useActionToast();
  const mutation = useMutationAction(client);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<SupportType | "">("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState("");
  const selected = useRef(files);
  useLayoutEffect(() => {
    selected.current = files;
  }, [files]);
  const attempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  useEffect(
    () => () => {
      for (const entry of selected.current) {
        URL.revokeObjectURL(entry.url);
        if (entry.attachmentId) void client.cancelUpload(entry.attachmentId).catch(() => {});
      }
    },
    [client],
  );
  async function remove(entry: SelectedFile) {
    setError("");
    const accepted = await mutation.run(
      async () => {
        if (entry.attachmentId) await client.cancelUpload(entry.attachmentId);
      },
      () => {
        URL.revokeObjectURL(entry.url);
        setFiles((values) => values.filter((value) => value !== entry));
      },
    );
    if (!accepted && mutation.isCurrent()) setError(labels.saveError);
  }
  async function submit() {
    if (mutation.pending) return;
    setError("");
    const value = {
      title,
      description: body,
      type,
      body,
      id: ticketId,
      attachmentIds: files.map((file) => file.requestId),
      requestId: "validate",
    };
    if (!(ticketId ? supportCommentSchema : supportCreateSchema).safeParse(value).success) {
      setError(labels.invalid);
      return;
    }
    onPendingChange?.(true);
    const accepted = await mutation.run(
      async () => {
        for (const entry of files) {
          if (!mutation.isCurrent()) throw new Error("Composer departed");
          if (!entry.attachmentId) {
            const file = await client.upload({ requestId: entry.requestId, file: entry.file });
            entry.attachmentId = file.id;
            if (!mutation.isCurrent()) {
              void client.cancelUpload(file.id).catch(() => {});
              throw new Error("Composer departed");
            }
          }
        }
        const attachmentIds = files.map((file) => file.attachmentId!);
        const fingerprint = JSON.stringify([title, body, type, attachmentIds]);
        if (attempt.current?.fingerprint !== fingerprint)
          attempt.current = { fingerprint, requestId: crypto.randomUUID() };
        const requestId = attempt.current.requestId;
        if (ticketId) {
          await client.comment({ id: ticketId, body, attachmentIds, requestId });
          return undefined;
        }
        return client.create(
          supportCreateSchema.parse({ title, description: body, type, attachmentIds, requestId }),
        );
      },
      (created) => {
        for (const entry of files) URL.revokeObjectURL(entry.url);
        selected.current = [];
        setFiles([]);
        setTitle("");
        setBody("");
        setType("");
        attempt.current = null;
        toast(created ? labels.created : labels.posted);
        if (created) onCreated?.(created);
        else onChanged?.();
      },
    );
    if (mutation.isCurrent()) {
      onPendingChange?.(false);
      if (!accepted) setError(labels.saveError);
    }
  }
  const failure = mutation.error ? supportError(mutation.error, labels) : error;
  return (
    <div onKeyDownCapture={submitFormOnShortcut}>
      <form
        className={ticketId ? "space-y-6" : "space-y-4"}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={mutation.pending}
      >
        {children}
        <fieldset disabled={mutation.pending} className="min-w-0 space-y-4">
          {!ticketId && (
            <>
              <div className="space-y-2">
                <label htmlFor={`${id}-title`} className="text-sm font-medium">
                  {labels.ticketTitle} <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${id}-title`}
                  className={inputClass}
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-type`} className="text-sm font-medium">
                  {labels.type} <span aria-hidden="true">*</span>
                </label>
                <NativeSelect
                  id={`${id}-type`}
                  required
                  className={inputClass}
                  value={type}
                  onChange={(event) => setType(event.target.value as SupportType)}
                >
                  <option value="">{labels.chooseType}</option>
                  {(["bug", "feature", "support"] as const).map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </>
          )}
          <div className="space-y-2">
            <label htmlFor={`${id}-body`} className="text-sm font-medium">
              {ticketId ? labels.reply : labels.description}{" "}
              {!ticketId && <span aria-hidden="true">*</span>}
            </label>
            <textarea
              id={`${id}-body`}
              className={cn(inputClass, "min-h-32 resize-y")}
              required={!ticketId}
              maxLength={5000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-describedby={`${id}-markdown`}
            />
            <p id={`${id}-markdown`} className="text-xs text-muted-foreground">
              {labels.markdown}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-images`} className="text-sm font-medium">
              {labels.images}
            </label>
            <input
              id={`${id}-images`}
              type="file"
              multiple
              accept={SUPPORT_IMAGE_TYPES.join(",")}
              className={cn(
                inputClass,
                "cursor-pointer file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:text-foreground",
              )}
              aria-describedby={`${id}-limits`}
              onChange={(event) => {
                const additions = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (
                  additions.length + files.length > SUPPORT_MAX_IMAGES ||
                  additions.some(
                    (file) =>
                      !SUPPORT_IMAGE_TYPES.includes(file.type) ||
                      !file.size ||
                      file.size > SUPPORT_MAX_IMAGE_BYTES,
                  )
                ) {
                  setError(labels.invalidImages);
                  return;
                }
                setError("");
                setFiles((current) => [
                  ...current,
                  ...additions.map((file) => ({
                    file,
                    requestId: crypto.randomUUID(),
                    url: URL.createObjectURL(file),
                  })),
                ]);
              }}
            />
            <p id={`${id}-limits`} className="text-xs text-muted-foreground">
              {labels.imagesHint}
            </p>
          </div>
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {files.map((entry) => (
                <li key={entry.requestId} className="relative w-28 space-y-1">
                  <img
                    src={entry.url}
                    alt={entry.file.name}
                    className="aspect-[4/3] w-full rounded-md border border-border object-contain"
                  />
                  <span className="block text-xs break-words">{entry.file.name}</span>
                  <IconTooltip label={`${labels.remove}: ${entry.file.name}`}>
                    <button
                      className={cn(buttonClass, "absolute top-1 right-1 size-8 bg-background p-0")}
                      type="button"
                      aria-label={`${labels.remove}: ${entry.file.name}`}
                      onClick={() => void remove(entry)}
                    >
                      <XIcon aria-hidden="true" className="size-4" />
                    </button>
                  </IconTooltip>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <div className={cn("flex flex-wrap justify-end gap-2", ticketId && editorActionsClass)}>
          {actions}
          {onCancel && (
            <button
              type="button"
              className={buttonClass}
              disabled={mutation.pending}
              onClick={onCancel}
            >
              {labels.cancel}
            </button>
          )}
          <button type="submit" className={primaryClass} disabled={mutation.pending}>
            {mutation.pending ? labels.saving : ticketId ? labels.post : labels.create}
          </button>
        </div>
      </form>
    </div>
  );
}
