"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CopyIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { securityLabels, type SecurityLabels } from "@/components/plugins/auth/account-labels";
import {
  accountButtonClass,
  accountPrimaryClass,
  accountCardClass,
  accountInputClass,
  accountDialogClass,
  accountDate,
} from "@/components/plugins/auth/account-styles";
import { cn } from "@/components/utils/cn";

export interface AgentKey {
  id: string;
  name: string;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  expiresAt: Date | string;
  expired: boolean;
  revoked?: boolean;
}
export interface AgentKeysProps {
  keys?: AgentKey[];
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onCreate?: (input: { name: string; expiresAt: Date }) => Promise<{ token: string }>;
  onDelete: (id: string) => Promise<void>;
  labels?: Partial<SecurityLabels>;
  locale?: string;
  className?: string;
}
export function AgentKeys(props: AgentKeysProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.done}>
      <AgentKeysContent {...props} />
    </ActionToastProvider>
  );
}
function KeyDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-dark/50" />
        <Dialog.Popup className={accountDialogClass}>
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function AgentKeysContent({
  keys,
  loading = false,
  error = false,
  onRetry,
  onCreate,
  onDelete,
  labels: overrides,
  locale,
  className,
}: AgentKeysProps) {
  const labels = { ...securityLabels, ...overrides };
  const id = `factory-agent-key-${useId()}`;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [failure, setFailure] = useState("");
  const [secret, setSecret] = useState("");
  const [deleting, setDeleting] = useState<AgentKey | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const notify = useActionToast();
  const closeSecret = () => {
    setSecret("");
    setFailure("");
  };
  return (
    <section className={cn(accountCardClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-semibold">{labels.keys}</h2>
          <p className="text-sm text-muted-foreground">{labels.keysDescription}</p>
        </div>
        {onCreate && (
          <button
            type="button"
            className={cn(accountButtonClass, accountPrimaryClass)}
            disabled={!keys || error || pending}
            onClick={() => {
              const date = new Date(Date.now() + 30 * 86400000);
              date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
              setExpiry(date.toISOString().slice(0, 16));
              setName("");
              setFailure("");
              setCreating(true);
            }}
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.createKey}
          </button>
        )}
      </div>
      <div className="mt-5 min-h-24 min-w-0" aria-busy={loading}>
        {error && (
          <div role="alert" className="space-y-3">
            <p>{labels.keysError}</p>
            <button
              type="button"
              className={accountButtonClass}
              disabled={loading}
              onClick={onRetry}
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
              {labels.retry}
            </button>
          </div>
        )}
        {!keys ? (
          !error && <output>{labels.loadingKeys}</output>
        ) : !keys.length ? (
          <p className="py-6 text-muted-foreground">{labels.noKeys}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {(["name", "status", "created", "lastUsed", "expires"] as const).map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="p-2 text-left font-medium text-muted-foreground"
                    >
                      {labels[column]}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">{labels.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="border-b border-border last:border-0">
                    <td className="max-w-56 truncate p-2 font-medium">{key.name}</td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs",
                          key.expired || key.revoked
                            ? "bg-status-canceled text-status-canceled-foreground"
                            : "bg-status-success text-status-success-foreground",
                        )}
                      >
                        {key.revoked
                          ? labels.revoked
                          : key.expired
                            ? labels.expired
                            : labels.active}
                      </span>
                    </td>
                    <td className="p-2 whitespace-nowrap tabular-nums">
                      {accountDate(key.createdAt, locale)}
                    </td>
                    <td className="p-2 whitespace-nowrap tabular-nums">
                      {key.lastUsedAt ? accountDate(key.lastUsedAt, locale) : labels.never}
                    </td>
                    <td className="p-2 whitespace-nowrap tabular-nums">
                      {accountDate(key.expiresAt, locale)}
                    </td>
                    <td className="p-2 text-right">
                      <IconTooltip label={`${labels.delete} ${key.name}`}>
                        <button
                          type="button"
                          className={cn(accountButtonClass, "size-10 border-transparent p-0")}
                          aria-label={`${labels.delete} ${key.name}`}
                          disabled={error || pending}
                          onClick={() => {
                            setFailure("");
                            setDeleting(key);
                          }}
                        >
                          <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
                        </button>
                      </IconTooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <KeyDialog
        open={creating}
        onOpenChange={(open) => {
          if (!lock.current) setCreating(open);
        }}
        title={labels.createKey}
        description={labels.createDescription}
      >
        <form
          className="grid gap-4"
          aria-busy={pending}
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || error || !onCreate) return;
            const expiresAt = new Date(expiry);
            const now = Date.now();
            if (
              !name.trim() ||
              name.trim().length > 100 ||
              !Number.isFinite(expiresAt.getTime()) ||
              expiresAt.getTime() <= now ||
              expiresAt.getTime() > now + 90 * 86400000
            ) {
              setFailure(labels.invalidKey);
              return;
            }
            lock.current = true;
            setPending(true);
            setFailure("");
            try {
              const { token } = await onCreate({ name: name.trim(), expiresAt });
              setCreating(false);
              setSecret(token);
            } catch {
              setFailure(labels.createError);
            } finally {
              lock.current = false;
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <label htmlFor={`${id}-name`}>{labels.name}</label>
            <input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoComplete="off"
              readOnly={pending}
              className={accountInputClass}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-expiry`}>{labels.expiryDate}</label>
            <input
              id={`${id}-expiry`}
              type="datetime-local"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              required
              readOnly={pending}
              className={accountInputClass}
            />
          </div>
          <div className="min-h-5 text-sm text-destructive">
            {failure && <p role="alert">{failure}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={accountButtonClass}
              disabled={pending}
              onClick={() => setCreating(false)}
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              className={cn(accountButtonClass, accountPrimaryClass)}
              disabled={pending || error}
            >
              {pending ? labels.creating : labels.createKey}
            </button>
          </div>
        </form>
      </KeyDialog>
      <KeyDialog
        open={Boolean(secret)}
        onOpenChange={(open) => {
          if (!open) closeSecret();
        }}
        title={labels.keyCreated}
        description={labels.copyDescription}
      >
        <input
          aria-label={labels.newKey}
          value={secret}
          readOnly
          className={cn(accountInputClass, "font-mono")}
          onFocus={(e) => e.target.select()}
        />
        <div className="min-h-5 text-sm text-destructive">
          {failure && <p role="alert">{failure}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={accountButtonClass} onClick={closeSecret}>
            {labels.done}
          </button>
          <button
            type="button"
            className={cn(accountButtonClass, accountPrimaryClass)}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
                notify(labels.copied);
              } catch {
                setFailure(labels.copyError);
              }
            }}
          >
            <CopyIcon className="size-4 shrink-0" aria-hidden="true" />
            {labels.copy}
          </button>
        </div>
      </KeyDialog>
      <KeyDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !lock.current) setDeleting(null);
        }}
        title={labels.deleteKey}
        description={
          <>
            {labels.deleteDescription} <strong>{deleting?.name}</strong>
          </>
        }
      >
        <div className="min-h-5 text-sm text-destructive">
          {failure && <p role="alert">{failure}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={accountButtonClass}
            disabled={pending}
            onClick={() => setDeleting(null)}
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            className={cn(
              accountButtonClass,
              "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            disabled={pending || error}
            onClick={async () => {
              if (!deleting || lock.current) return;
              lock.current = true;
              setPending(true);
              setFailure("");
              try {
                await onDelete(deleting.id);
                setDeleting(null);
                notify(labels.deleted);
              } catch {
                setFailure(labels.deleteError);
              } finally {
                lock.current = false;
                setPending(false);
              }
            }}
          >
            {pending ? labels.deleting : labels.delete}
          </button>
        </div>
      </KeyDialog>
    </section>
  );
}
