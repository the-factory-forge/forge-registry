"use client";

import { LogOutIcon, RefreshCwIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { useLoadingActivity } from "@/components/loading-indicator";
import { securityLabels, type SecurityLabels } from "@/components/plugins/auth/account-labels";
import {
  accountButtonClass,
  accountCardClass,
  accountDate,
} from "@/components/plugins/auth/account-styles";
import { passwordLabels, type PasswordLabels } from "@/components/plugins/auth/password-labels";
import { cn } from "@/components/utils/cn";

export interface AccountSecurityData {
  signInMethod: string | null;
  providers: string[];
  sessions: {
    id: string;
    current: boolean;
    userAgent?: string | null;
    ipAddress?: string | null;
    createdAt: Date | string;
    expiresAt: Date | string;
  }[];
}
export interface AccountSecurityProps {
  email: string;
  data?: AccountSecurityData;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onRequestPasswordReset?: () => Promise<void>;
  onRevokeSession: (id: string) => Promise<void>;
  agentKeys?: ReactNode;
  /** The host's ChangePasswordForm adapter, shown only for a credential account. */
  passwordForm?: ReactNode;
  labels?: Partial<SecurityLabels>;
  passwordLabels?: Partial<PasswordLabels>;
  locale?: string;
  className?: string;
}
export function AccountSecurity({
  email,
  data,
  loading = false,
  error = false,
  onRetry,
  onRequestPasswordReset,
  onRevokeSession,
  agentKeys,
  passwordForm,
  labels: overrides,
  passwordLabels: passwordOverrides,
  locale,
  className,
}: AccountSecurityProps) {
  useLoadingActivity(loading);
  const labels = { ...securityLabels, ...overrides };
  const passwords = { ...passwordLabels, ...passwordOverrides };
  const [reset, setReset] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeFailed, setRevokeFailed] = useState(false);
  const resetLock = useRef(false);
  const revokeLock = useRef(false);
  const providerName = (provider: string) =>
    provider === "credential"
      ? labels.emailPassword
      : provider === "github"
        ? "GitHub"
        : provider === "google"
          ? "Google"
          : provider;
  return (
    <div className={cn("grid min-w-0 gap-6", className)}>
      {agentKeys}
      <section className={accountCardClass}>
        <h2 className="font-semibold">{labels.signInMethods}</h2>
        <div className="mt-4 min-h-24 space-y-4" aria-busy={loading}>
          {error && (
            <div role="alert" className="space-y-3">
              <p>{labels.securityError}</p>
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
          {!data ? (
            !error && <output>{labels.loadingSecurity}</output>
          ) : (
            <>
              <p className="text-muted-foreground">
                {data.signInMethod
                  ? `${labels.signedInWith} ${providerName(data.signInMethod)}`
                  : labels.unknownMethod}
              </p>
              <ul className="divide-y divide-border">
                {data.providers.map((provider) => (
                  <li
                    key={provider}
                    className="flex flex-wrap items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{providerName(provider)}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider === "credential" ? email : labels.connected}
                      </p>
                    </div>
                    {provider === "credential" && onRequestPasswordReset && (
                      <button
                        type="button"
                        className={accountButtonClass}
                        disabled={error || reset === "pending" || reset === "success"}
                        onClick={async () => {
                          if (resetLock.current) return;
                          resetLock.current = true;
                          setReset("pending");
                          try {
                            await onRequestPasswordReset();
                            setReset("success");
                          } catch {
                            setReset("error");
                            resetLock.current = false;
                          }
                        }}
                      >
                        {reset === "pending"
                          ? labels.sending
                          : reset === "success"
                            ? labels.resetSent
                            : labels.resetPassword}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="min-h-5 text-sm">
                {reset === "success" && (
                  <output className="text-muted-foreground">{passwords.resetSent}</output>
                )}
                {reset === "error" && (
                  <p role="alert" className="text-destructive">
                    {passwords.resetRequestError}
                  </p>
                )}
              </div>
              {data.providers.includes("credential") && passwordForm && !error && (
                <div className="max-w-md space-y-4 border-t border-border pt-4">
                  <h3 className="font-medium">{passwords.changePasswordTitle}</h3>
                  {passwordForm}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <section className={accountCardClass}>
        <h2 className="font-semibold">{labels.sessions}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{labels.sessionsDescription}</p>
        <div className="mt-4 min-h-24" aria-busy={loading}>
          {!data ? (
            <output>{error ? labels.sessionsUnavailable : labels.loadingSecurity}</output>
          ) : (
            <ul className="divide-y divide-border">
              {data.sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {session.current ? labels.currentSession : labels.otherSession}
                    </p>
                    <p className="max-w-2xl text-sm break-all text-muted-foreground">
                      {session.userAgent || labels.unknownBrowser}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {session.ipAddress || labels.unknownIp} · {labels.created}{" "}
                      {accountDate(session.createdAt, locale)} · {labels.expires}{" "}
                      {accountDate(session.expiresAt, locale)}
                    </p>
                  </div>
                  {!session.current && (
                    <button
                      type="button"
                      className={cn(accountButtonClass, "shrink-0 self-start sm:self-center")}
                      disabled={error || revoking !== null}
                      onClick={async () => {
                        if (revokeLock.current) return;
                        revokeLock.current = true;
                        setRevoking(session.id);
                        setRevokeFailed(false);
                        try {
                          await onRevokeSession(session.id);
                        } catch {
                          setRevokeFailed(true);
                        } finally {
                          revokeLock.current = false;
                          setRevoking(null);
                        }
                      }}
                    >
                      <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
                      {revoking === session.id ? labels.signingOut : labels.signOut}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 min-h-5 text-sm text-destructive">
            {revokeFailed && <p role="alert">{labels.revokeError}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
