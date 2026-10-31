"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { useLoadingActivity } from "@/components/loading-indicator";
import { outlineButtonClass } from "@/components/plugins/customers/ui";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

import type { BexioBulkSyncResult } from "./contracts";

const defaultLabels = {
  action: "Sync all from Bexio",
  pending: "Importing…",
  description:
    "Import Bexio contacts into customers. Existing login email changes require individual review.",
  error: "Import failed. Completed records remain saved. Resolve the connection issue and retry.",
  result: "Import results",
  created: "Created",
  linked: "Linked",
  updated: "Updated",
  skipped: "Skipped",
  failed: "Failed",
  issues: "Records needing review",
};
export interface BexioSyncAllButtonProps {
  syncAll: () => Promise<BexioBulkSyncResult>;
  onSynced?: (result: BexioBulkSyncResult) => void;
  canWrite?: boolean;
  labels?: Partial<typeof defaultLabels>;
}

export function BexioSyncAllButton({
  syncAll,
  onSynced,
  canWrite = true,
  labels: overrides,
}: BexioSyncAllButtonProps) {
  const labels = { ...defaultLabels, ...overrides };
  const mutation = useMutationAction(syncAll);
  const [completed, setCompleted] = useState<{
    owner: typeof syncAll;
    result: BexioBulkSyncResult;
  } | null>(null);
  if (completed && completed.owner !== syncAll) setCompleted(null);
  const result = completed?.owner === syncAll ? completed.result : null;
  useLoadingActivity(mutation.pending);
  return (
    <section className="space-y-3" aria-label={labels.action} aria-busy={mutation.pending}>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <button
        type="button"
        className={outlineButtonClass}
        disabled={!canWrite || mutation.pending}
        onClick={() => {
          if (!canWrite) return;
          void mutation.run(syncAll, (value) => {
            setCompleted({ owner: syncAll, result: value });
            onSynced?.(value);
          });
        }}
      >
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        {labels.action}
      </button>
      <div className="min-h-6 text-sm" aria-live="polite">
        {mutation.pending ? (
          labels.pending
        ) : mutation.error ? (
          <p role="alert" className="text-destructive">
            {labels.error}
          </p>
        ) : null}
      </div>
      {result && (
        <section className="space-y-3" aria-label={labels.result}>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {(["created", "linked", "updated", "skipped", "failed"] as const).map((key) => (
              <div key={key}>
                <dt className="text-muted-foreground">{labels[key]}</dt>
                <dd className="font-medium">{result[key]}</dd>
              </div>
            ))}
          </dl>
          {result.issues.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm">{labels.issues}</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {result.issues.map((issue, index) => (
                  <li key={`${issue.bexioContactId}-${index}`}>
                    #{issue.bexioContactId}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </section>
  );
}
