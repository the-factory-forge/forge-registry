"use client";

import { Dialog } from "@base-ui/react/dialog";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  SupportsGithubClient,
  SupportsGithubConnection,
} from "@/components/connectors/supports-github/contracts";
import { IconTooltip } from "@/components/icon-tooltip";
import { buttonClass, primaryClass } from "@/components/plugins/supports/ui";
import { cn } from "@/components/utils/cn";
import { useMutationAction } from "@/components/utils/use-optimistic-action";
export type * from "@/components/connectors/supports-github/contracts";

export const supportsGithubLabels = {
  title: "GitHub",
  unlinked: "Not connected",
  pending: "Delivery pending",
  synchronized: "Synchronized",
  failed: "Delivery failed",
  blocked: "Delivery blocked",
  loading: "Loading connection…",
  loadError: "Could not load the connection.",
  actionError: "The action failed. Refresh the connection and try again.",
  refresh: "Refresh GitHub connection",
  issue: "View GitHub issue",
  send: "Send to GitHub",
  retry: "Retry delivery",
  cancel: "Cancel",
  saving: "Saving…",
  confirmTitle: "Send this discussion to GitHub?",
  confirmDescription:
    "This sends the original description, all saved replies, author names, and current status to the site's private repository. Images stay in their original system and are linked, not copied.",
  images: "Images are not copied. Viewing originals requires access to their source system.",
  DELIVERY:
    "GitHub could not be reached or rejected the delivery. Retry after checking the connection.",
  ACCESS: "GitHub access needs to be restored before delivery can resume.",
  REPOSITORY:
    "The configured repository changed or is unavailable for private support. Contact maintenance.",
  UNCERTAIN:
    "GitHub may have received this write. Maintenance must reconcile it before it can be resent.",
  MISSING: "The linked issue was deleted, moved, or is inaccessible. Contact maintenance.",
  TOO_LONG: "A reply exceeded the import limit. Read the original on GitHub.",
  STALE_STATUS:
    "A newer GitHub status replaced an older queued change. Change the ticket status again if needed.",
};
export type SupportsGithubLabels = typeof supportsGithubLabels;
export interface SupportGithubCardProps {
  ticketId: string;
  client: SupportsGithubClient;
  canWrite?: boolean;
  /** Host data revision: reload delivery state after a local ticket mutation. */
  revision?: unknown;
  onChanged?: () => void;
  labels?: Partial<SupportsGithubLabels>;
  className?: string;
}
export function SupportGithubCard({
  ticketId,
  client,
  canWrite = true,
  revision,
  onChanged,
  labels: overrides,
  className,
}: SupportGithubCardProps) {
  const labels = { ...supportsGithubLabels, ...overrides };
  const scope = useMemo(() => ({ ticketId, client }), [ticketId, client]);
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<{
    scope: typeof scope;
    value?: SupportsGithubConnection;
    error?: boolean;
  }>();
  const [confirmScope, setConfirmScope] = useState<typeof scope | null>(null);
  const mutation = useMutationAction(scope);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void client
      .get(ticketId)
      .then((value) => {
        if (active) setLoaded({ scope, value });
      })
      .catch(() => {
        if (active) setLoaded({ scope, error: true });
      });
    return () => {
      active = false;
    };
  }, [client, ticketId, scope, refresh, revision]);
  const current = loaded?.scope === scope ? loaded : undefined;
  const connection = current?.value;
  const confirming = confirmScope === scope;
  const change = (action: () => Promise<void>) => {
    void mutation.run(action, () => {
      setConfirmScope(null);
      setRefresh((value) => value + 1);
      onChanged?.();
    });
  };
  const issueUrl =
    connection?.issueUrl &&
    /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+\/issues\/\d+$/.test(connection.issueUrl)
      ? connection.issueUrl
      : null;
  return (
    <section
      aria-label={labels.title}
      className={cn("space-y-3 rounded-lg border border-border p-4 text-foreground", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-sm text-muted-foreground">
            {connection
              ? labels[connection.state]
              : current?.error
                ? labels.loadError
                : labels.loading}
          </span>
          <IconTooltip label={labels.refresh}>
            <button
              type="button"
              aria-label={labels.refresh}
              className={cn(buttonClass, "size-10 p-0 md:size-8")}
              disabled={mutation.pending}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </IconTooltip>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{labels.images}</p>
      {connection?.failure && (
        <p role="alert" className="text-sm text-destructive">
          {labels[connection.failure]}
        </p>
      )}
      {mutation.error && !confirming && (
        <p role="alert" className="text-sm text-destructive">
          {labels.actionError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {issueUrl && (
          <a href={issueUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            {labels.issue}
          </a>
        )}
        {connection?.state === "unlinked" && (
          <button
            ref={trigger}
            type="button"
            disabled={!canWrite || mutation.pending}
            className={primaryClass}
            onClick={() => setConfirmScope(scope)}
          >
            {labels.send}
          </button>
        )}
        {connection?.canRetry && (
          <button
            type="button"
            className={buttonClass}
            disabled={!canWrite || mutation.pending}
            onClick={() => change(() => client.retry(ticketId))}
          >
            {mutation.pending ? labels.saving : labels.retry}
          </button>
        )}
      </div>
      <Dialog.Root
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !mutation.pending) setConfirmScope(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
          <Dialog.Popup
            initialFocus={cancel}
            finalFocus={trigger}
            className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"
          >
            <Dialog.Title className="text-lg font-semibold">{labels.confirmTitle}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.confirmDescription}
            </Dialog.Description>
            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {labels.actionError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close ref={cancel} disabled={mutation.pending} className={buttonClass}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={!canWrite || mutation.pending}
                aria-busy={mutation.pending}
                className={primaryClass}
                onClick={() => change(() => client.exportTicket(ticketId))}
              >
                {mutation.pending ? labels.saving : labels.send}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
