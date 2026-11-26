"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  getWebMcpContext,
  registerAgentsWebMcp,
} from "@/components/connectors/agents-webmcp/browser";
import type {
  AgentsWebMcpClient,
  WebMcpProposal,
} from "@/components/connectors/agents-webmcp/types";
import { AgentActionReview } from "@/components/plugins/agents";
import { agentsLabels, type AgentsLabels } from "@/components/plugins/agents/labels";
import { AgentsError } from "@/components/plugins/agents/types";

export type * from "@/components/connectors/agents-webmcp/types";
export {
  getWebMcpContext,
  registerAgentsWebMcp,
} from "@/components/connectors/agents-webmcp/browser";

export interface AgentsWebMcpProps {
  client: AgentsWebMcpClient;
  /** Change with the page, acting session or permissions to replace tools and cancel unapproved reviews. */
  contextKey: string;
  /** Explicit host-owned page state only; omit secrets and arbitrary form contents. */
  getContext: () => unknown;
  onChange?: (operationId: string) => void | Promise<void>;
  labels?: Partial<AgentsLabels> & { reviewTitle?: string; reviewDescription?: string };
}

/** Mount inside the authenticated layout. Unsupported browsers keep the normal website. */
export function AgentsWebMcp({
  client,
  contextKey,
  getContext,
  onChange,
  labels: overrides,
}: AgentsWebMcpProps) {
  const labels = {
    ...agentsLabels,
    reviewTitle: "Request from your assistant",
    reviewDescription: "Review this change before applying it to the website.",
    ...overrides,
  };
  const [proposal, setProposal] = useState<WebMcpProposal>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef({ getContext, onChange });
  useLayoutEffect(() => {
    callbacks.current = { getContext, onChange };
  }, [getContext, onChange]);
  const pending = useRef<{
    value: WebMcpProposal;
    resolve(value: WebMcpProposal): void;
    reject(error: unknown): void;
    removeAbort(): void;
    approved: boolean;
    client: AgentsWebMcpClient;
    signal: AbortSignal;
  } | null>(null);

  useEffect(() => {
    const model = getWebMcpContext();
    if (!model) return;
    const controller = new AbortController();
    void (async () => {
      const catalog = await client.catalog(controller.signal);
      await registerAgentsWebMcp({
        model,
        catalog,
        signal: controller.signal,
        context: async (signal) => {
          await client.catalog(signal);
          signal.throwIfAborted();
          return callbacks.current.getContext();
        },
        call: (name, input, signal) => client.call(name, input, signal),
        proposal: ({ proposalId }, signal) => client.proposal(proposalId, signal),
        review: (value, signal) =>
          new Promise((resolve, reject) => {
            signal.throwIfAborted();
            if (pending.current) {
              reject(new AgentsError("BUSY"));
              return;
            }
            const cancel = () => {
              if (pending.current !== request || request.approved) return;
              pending.current.removeAbort();
              pending.current = null;
              setProposal(undefined);
              setBusy(false);
              reject(signal.reason);
              void client
                .decide({ proposalId: value.proposalId, approve: false, review: value.preview })
                .catch(() => {});
            };
            const request = {
              value,
              resolve,
              reject,
              approved: false,
              client,
              signal: controller.signal,
              removeAbort: () => signal.removeEventListener("abort", cancel),
            };
            pending.current = request;
            signal.addEventListener("abort", cancel, { once: true });
            setError("");
            setProposal(value);
          }),
      });
    })().catch(() => {
      if (!controller.signal.aborted) setError(labels.unavailable);
      controller.abort();
    });
    return () => {
      controller.abort();
      if (pending.current?.signal === controller.signal) {
        pending.current.removeAbort();
        pending.current = null;
      }
      setProposal(undefined);
      setBusy(false);
      setError("");
    };
  }, [client, contextKey, labels.unavailable]);

  async function decide(approve: boolean) {
    const request = pending.current;
    if (!request || busy) return;
    const current = () => pending.current === request && !request.signal.aborted;
    let completed = false;
    request.approved = approve;
    if (approve) request.removeAbort();
    setBusy(true);
    setError("");
    try {
      // An approved write keeps its durable outcome even when the browser invocation is cancelled.
      const value = await request.client.decide({
        proposalId: request.value.proposalId,
        approve,
        review: request.value.preview,
      });
      request.removeAbort();
      if (current()) {
        setProposal(value);
        if (value.status === "succeeded" || value.status === "unresolved") {
          try {
            await callbacks.current.onChange?.(value.operationId);
          } catch {
            if (current()) setError(labels.unavailable);
          }
        }
      }
      completed = true;
      request.resolve(value);
    } catch (error) {
      request.reject(error);
      if (current())
        setError(
          error instanceof AgentsError && error.code === "FORBIDDEN"
            ? labels.unavailable
            : approve
              ? labels.unresolved
              : labels.unavailable,
        );
    } finally {
      if (current()) {
        if (completed) pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <>
      {!proposal && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Dialog.Root
        open={!!proposal}
        onOpenChange={(open) => {
          if (open || busy) return;
          const request = pending.current;
          if (request) {
            request.removeAbort();
            pending.current = null;
            request.reject(new AgentsError(request.approved ? "UNRESOLVED" : "INVALID"));
            if (!request.approved)
              void request.client
                .decide({
                  proposalId: request.value.proposalId,
                  approve: false,
                  review: request.value.preview,
                })
                .catch(() => {});
          }
          setProposal(undefined);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[1200] bg-black/40" />
          <Dialog.Popup
            initialFocus={heading}
            className="fixed top-1/2 left-1/2 z-[1200] max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-popover p-6 text-popover-foreground"
          >
            <Dialog.Title ref={heading} tabIndex={-1} className="text-lg font-semibold">
              {labels.reviewTitle}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {labels.reviewDescription}
            </Dialog.Description>
            {proposal && (
              <AgentActionReview
                action={proposal}
                disabled={busy}
                decide={(approve) => void decide(approve)}
                labels={labels}
              />
            )}
            {error && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {error}
              </p>
            )}
            <Dialog.Close
              disabled={busy}
              className="min-h-10 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {labels.close}
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
