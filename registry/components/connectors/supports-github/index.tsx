"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Toast } from "@base-ui/react/toast";
import { RefreshCwIcon, UnplugIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import type {
  SupportsGithubClient,
  SupportsGithubConnection,
} from "@/components/connectors/supports-github/contracts";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  buttonClass,
  primaryClass,
  supportStatusBadgeClass,
} from "@/components/plugins/supports/ui";
import { cn } from "@/components/utils/cn";
import { useMutationAction } from "@/components/utils/use-optimistic-action";
export type * from "@/components/connectors/supports-github/contracts";

export const supportsGithubLabels = {
  title: "GitHub",
  unlinked: "Not connected",
  pending: "Delivery pending",
  pendingStatus: "Pending",
  synchronized: "Synchronized",
  failed: "Delivery failed",
  blocked: "Delivery blocked",
  unconfirmed: "Awaiting GitHub confirmation",
  loading: "Loading connection…",
  loadError: "Could not load the connection.",
  actionError: "The action failed. Refresh the connection and try again.",
  refresh: "Refresh GitHub connection",
  issue: "View GitHub issue",
  send: "Send to GitHub",
  savedForSend: "Your ticket is saved here. Send it to GitHub when the connection is back.",
  retry: "Retry delivery",
  cancel: "Cancel",
  saving: "Saving…",
  confirmTitle: "Send this discussion to GitHub?",
  confirmDescription:
    "This sends the title, type, description, saved replies, author names, status, and any assigned priority to the site's private repository. Any attached images are shared as links.",
  images: "Viewing these images from GitHub requires access to this discussion.",
  DELIVERY:
    "GitHub could not be reached or rejected the delivery. Retry after checking the connection.",
  ACCESS:
    "GitHub denied access. Ask an administrator to check the GitHub App installation, then retry.",
  REPOSITORY:
    "The configured repository changed or is unavailable for private support. Contact maintenance.",
  UNCERTAIN:
    "GitHub may have received this change. Retry to check for confirmation. Contact maintenance if it stays unconfirmed.",
  MISSING: "The linked issue was deleted, moved, or is inaccessible. Contact maintenance.",
  TOO_LONG: "A reply exceeded the import limit. Read the original on GitHub.",
  STALE_STATUS:
    "A newer GitHub status replaced an older queued change. Change the ticket status again if needed.",
};
export type SupportsGithubLabels = Omit<
  typeof supportsGithubLabels,
  "pendingStatus" | "unconfirmed" | "savedForSend"
> &
  Partial<Pick<typeof supportsGithubLabels, "pendingStatus" | "unconfirmed" | "savedForSend">>;

function useGithubAction(
  scope: { client: SupportsGithubClient; ticketId: string },
  labels: typeof supportsGithubLabels,
) {
  const mutation = useMutationAction(scope);
  const { add } = Toast.useToastManager();
  function run(
    action: () => Promise<SupportsGithubConnection | void>,
    settled: (connection: SupportsGithubConnection | null) => void,
  ) {
    return mutation.run(
      () =>
        action()
          .then((result) => result ?? scope.client.get(scope.ticketId))
          .catch(() => null),
      (connection) => {
        if (!connection) add({ title: labels.actionError, type: "error" });
        else if (connection.failure) add({ title: labels[connection.failure], type: "error" });
        else if (connection.state === "pending") add({ title: labels.pending, type: "info" });
        settled(connection);
      },
    );
  }
  return { pending: mutation.pending, run };
}

export interface SupportGithubCardProps {
  ticketId: string;
  client: SupportsGithubClient;
  canWrite?: boolean;
  /** Host data revision: reload delivery state after a local ticket mutation. */
  revision?: unknown;
  onChanged?: () => void;
  onRefresh?: () => Promise<void>;
  labels?: Partial<SupportsGithubLabels>;
  className?: string;
}
export function SupportGithubCard(props: SupportGithubCardProps) {
  return (
    <ActionToastProvider>
      <GithubCard {...props} />
    </ActionToastProvider>
  );
}
function GithubCard({
  ticketId,
  client,
  canWrite = true,
  revision,
  onChanged,
  onRefresh,
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
  const mutation = useGithubAction(scope, labels);
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
  const awaitingSend =
    connection?.canRetry &&
    connection.issueUrl === null &&
    connection.failure != null &&
    connection.failure !== "UNCERTAIN";
  const refreshConnection = () => {
    setRefresh((value) => value + 1);
    onChanged?.();
  };
  const change = (action: () => Promise<SupportsGithubConnection | void>) => {
    void mutation.run(action, (value) => {
      if (value) setLoaded({ scope, value });
      else setRefresh((previous) => previous + 1);
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
              ? labels[connection.failure === "UNCERTAIN" ? "unconfirmed" : connection.state]
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
              onClick={() =>
                change(async () => {
                  await onRefresh?.();
                  return client.get(ticketId);
                })
              }
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </IconTooltip>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {issueUrl && (
          <a href={issueUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            {labels.issue}
          </a>
        )}
        {connection?.state === "unlinked" && (
          <SupportGithubSendButton
            key={ticketId}
            ticketId={ticketId}
            client={client}
            action="export"
            canWrite={canWrite && !mutation.pending}
            labels={labels}
            onChanged={refreshConnection}
          />
        )}
        {connection?.canRetry && (
          <button
            type="button"
            className={awaitingSend ? primaryClass : buttonClass}
            disabled={!canWrite || mutation.pending}
            onClick={() => change(() => client.retry(ticketId))}
          >
            {mutation.pending ? labels.saving : awaitingSend ? labels.send : labels.retry}
          </button>
        )}
      </div>
    </section>
  );
}

type SendButtonProps = Pick<
  SupportGithubCardProps,
  "ticketId" | "client" | "canWrite" | "labels" | "onChanged"
> & {
  action: "export" | "retry";
  badge?: boolean;
  failed?: boolean;
};
export function SupportGithubSendButton(props: SendButtonProps) {
  return (
    <ActionToastProvider>
      <SendButton {...props} />
    </ActionToastProvider>
  );
}
function SendButton({
  ticketId,
  client,
  action,
  badge = false,
  failed = false,
  canWrite = true,
  labels: overrides,
  onChanged,
}: SendButtonProps) {
  const labels = { ...supportsGithubLabels, ...overrides };
  const scope = useMemo(() => ({ ticketId, client }), [ticketId, client]);
  const [confirmScope, setConfirmScope] = useState<typeof scope | null>(null);
  const [failedScope, setFailedScope] = useState<typeof scope | null>(null);
  const confirming = confirmScope === scope;
  const mutation = useGithubAction(scope, labels);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const disconnected = failed || failedScope === scope;
  const hint = disconnected ? `${labels.failed} – ${labels.retry}` : labels.send;
  const StatusIcon = disconnected && !mutation.pending ? UnplugIcon : RefreshCwIcon;
  const send = () => {
    void mutation.run(
      () => (action === "export" ? client.exportTicket(ticketId) : client.retry(ticketId)),
      (connection) => {
        setConfirmScope(null);
        setFailedScope(!connection || connection.failure ? scope : null);
        onChanged?.();
      },
    );
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={!canWrite || mutation.pending}
        aria-busy={mutation.pending}
        aria-haspopup={action === "export" && canWrite ? "dialog" : undefined}
        aria-label={badge ? `${labels.pendingStatus} – ${hint}` : undefined}
        className={
          badge
            ? cn(
                supportStatusBadgeClass,
                "min-h-6 scroll-me-24 bg-status-not-started text-status-not-started-foreground underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring enabled:hover:underline aria-busy:cursor-wait",
                (canWrite || disconnected) && "before:hidden",
              )
            : primaryClass
        }
        onClick={() => (action === "export" ? setConfirmScope(scope) : send())}
      >
        {badge && (canWrite || disconnected) && (
          <StatusIcon
            aria-hidden="true"
            className={cn("size-3 shrink-0", mutation.pending && "motion-safe:animate-spin")}
          />
        )}
        {badge ? labels.pendingStatus : labels.send}
      </button>
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
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close ref={cancel} disabled={mutation.pending} className={buttonClass}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                disabled={!canWrite || mutation.pending}
                aria-busy={mutation.pending}
                className={primaryClass}
                onClick={send}
              >
                {mutation.pending ? labels.saving : labels.send}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
