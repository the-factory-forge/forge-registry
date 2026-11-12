"use client";

import { Markdown } from "@tanstack/markdown/react";
import { useEffect, useState } from "react";

import { actionToastButtonClass } from "@/components/action-toast";
import type { SupportsLabels } from "@/components/plugins/supports/labels";
import type {
  SupportAttachment,
  SupportStatus,
  SupportsClient,
} from "@/components/plugins/supports/types";
import { cn } from "@/components/utils/cn";

export const buttonClass = `${actionToastButtonClass} border border-border`;
export const primaryClass = `${actionToastButtonClass} bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground`;
export const inputClass =
  "min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm";
export function SupportMarkdown({ value }: { value: string }) {
  return (
    <div className="min-w-0 space-y-3 text-sm leading-7 break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc">
      <Markdown
        allowHtml={false}
        urlTransform={(_url, kind, safe) => (kind === "image" ? null : safe)}
        components={{ h1: ({ children }) => <h2>{children}</h2> }}
      >
        {value}
      </Markdown>
    </div>
  );
}
export function SupportStatusBadge({
  status,
  labels,
}: {
  status: SupportStatus;
  labels: SupportsLabels;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        status === "open"
          ? "bg-status-pending text-status-pending-foreground"
          : status === "closed"
            ? "bg-status-success text-status-success-foreground"
            : "bg-muted-foreground/15 text-muted-foreground",
      )}
    >
      {labels[status]}
    </span>
  );
}
export function supportError(error: unknown, labels: SupportsLabels) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "STORAGE_NOT_CONFIGURED") return labels.storageMissing;
  if (code === "INVALID") return labels.invalid;
  if (code === "FORBIDDEN") return labels.forbidden;
  if (code === "CONFLICT") return labels.conflict;
  return labels.saveError;
}
function Attachment({
  file,
  client,
  labels,
}: {
  file: SupportAttachment;
  client: SupportsClient;
  labels: SupportsLabels;
}) {
  const [state, setState] = useState<{ url?: string; error?: boolean }>({});
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    void client
      .getAttachment(file.id)
      .then(({ url }) => {
        if (!/^(https?:\/\/|blob:)/.test(url) && !/^\/(?!\/)/.test(url))
          throw new Error("Invalid image URL");
        if (active) setState({ url });
      })
      .catch(() => {
        if (active) setState({ error: true });
      });
    return () => {
      active = false;
    };
  }, [client, file.id, attempt]);
  return (
    <figure className="w-40 max-w-full space-y-1">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {state.error ? (
          <button
            className={buttonClass}
            type="button"
            aria-label={`${labels.retry}: ${file.name}`}
            onClick={() => {
              setState({});
              retry(attempt + 1);
            }}
          >
            {labels.retry}
          </button>
        ) : state.url ? (
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={state.url}
              alt={file.name}
              className="size-full object-contain"
              onError={() => setState({ error: true })}
            />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{labels.loading}</span>
        )}
      </div>
      <figcaption className="text-xs break-words text-muted-foreground">{file.name}</figcaption>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {labels.imageError}
        </p>
      )}
    </figure>
  );
}
export function SupportAttachments({
  files,
  client,
  labels,
}: {
  files: readonly SupportAttachment[];
  client: SupportsClient;
  labels: SupportsLabels;
}) {
  return files.length ? (
    <div className="flex flex-wrap gap-3">
      {files.map((file) => (
        <Attachment key={file.id} file={file} client={client} labels={labels} />
      ))}
    </div>
  ) : null;
}
