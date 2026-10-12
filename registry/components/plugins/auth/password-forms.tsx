"use client";

import {
  ArrowLeftIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  MailCheckIcon,
} from "lucide-react";
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { passwordLabels, type PasswordLabels } from "@/components/plugins/auth/password-labels";
import { cn } from "@/components/utils/cn";

const inputClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
const buttonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";
const linkClass =
  "inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

interface FormProps {
  labels?: Partial<PasswordLabels>;
  className?: string;
}
interface RecoveryProps extends FormProps {
  enabled?: boolean;
  loginHref?: string;
  linkComponent?: ComponentType<LinkProps>;
}
export interface ForgotPasswordFormProps extends RecoveryProps {
  onRequestReset: (email: string) => Promise<void>;
}
export interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordFormProps extends FormProps {
  /** The host must validate the session, current password and new password on the server. */
  onChangePassword: (values: ChangePasswordValues) => Promise<void>;
  minLength?: number;
  maxLength?: number;
}
export interface ResetPasswordFormProps extends RecoveryProps {
  /** The host checks the link before rendering; the server must verify the token on submission. */
  validLink: boolean;
  onResetPassword: (newPassword: string) => Promise<void>;
  requestResetHref?: string;
  minLength?: number;
  maxLength?: number;
}
export type ChangePasswordPageProps = ChangePasswordFormProps;

type PasswordFormProps = ChangePasswordFormProps & {
  mode?: "change" | "reset";
  fullWidthSubmit?: boolean;
  requestResetLink?: ReactNode;
};

function useSubmission() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  async function submit(action: () => Promise<void>, form: HTMLFormElement) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFailed(false);
    setSucceeded(false);
    try {
      await action();
      form.reset();
      setSucceeded(true);
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, failed, succeeded, submit };
}

export function ForgotPasswordForm({
  onRequestReset,
  enabled = true,
  loginHref,
  labels: overrides,
  className,
  linkComponent: FormLink = Link,
}: ForgotPasswordFormProps) {
  const labels = { ...passwordLabels, ...overrides };
  const id = `factory-password-form-${useId()}`;
  const state = useSubmission();
  return (
    <div className={cn("grid gap-6", className)}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {state.succeeded ? labels.checkEmail : labels.forgotTitle}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state.succeeded ? labels.resetSent : labels.forgotDescription}
        </p>
      </div>
      {state.succeeded ? (
        <output className="flex items-center gap-3 rounded-xl bg-status-success p-4 text-sm text-status-success-foreground">
          <MailCheckIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {labels.checkSpam}
        </output>
      ) : !enabled ? (
        <output className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
          {labels.resetUnavailable}
        </output>
      ) : (
        <form
          className="grid gap-5"
          aria-busy={state.pending}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (state.pending || !form.reportValidity()) return;
            const email = new FormData(form).get("email");
            if (typeof email === "string")
              void state.submit(() => onRequestReset(email.trim()), form);
          }}
        >
          <div className="grid gap-2">
            <label htmlFor={`${id}-email`}>{labels.email}</label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
              required
              readOnly={state.pending}
              aria-describedby={state.failed ? `${id}-error` : undefined}
            />
          </div>
          {state.failed && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {labels.resetRequestError}
            </p>
          )}
          <button type="submit" className={buttonClass} disabled={state.pending}>
            {state.pending && (
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            )}
            {state.pending ? labels.sendingLink : labels.sendResetLink}
          </button>
        </form>
      )}
      {loginHref && (
        <FormLink
          href={loginHref}
          className={cn(
            linkClass,
            "min-h-10 justify-self-start rounded-lg px-3 hover:bg-primary/5 hover:no-underline",
          )}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {labels.backToLogin}
        </FormLink>
      )}
    </div>
  );
}

function PasswordFormContent({
  onChangePassword,
  minLength = 8,
  maxLength = 128,
  labels: overrides,
  className,
  mode = "change",
  fullWidthSubmit,
  requestResetLink,
}: PasswordFormProps) {
  const labels = { ...passwordLabels, ...overrides };
  const id = `factory-password-form-${useId()}`;
  const state = useSubmission();
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const reset = mode === "reset";
  const notify = useActionToast();
  return (
    <div className={cn("grid gap-5", className)}>
      {reset && state.succeeded && (
        <output className="flex items-center gap-3 rounded-xl bg-status-success p-4 text-sm text-status-success-foreground">
          <CheckCircleIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {labels.resetSuccess}
        </output>
      )}
      {!(reset && state.succeeded) && (
        <form
          className="grid gap-5"
          aria-busy={state.pending}
          onReset={() => setVisiblePasswords({ currentPassword: false, newPassword: false })}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (state.pending || !form.reportValidity()) return;
            const data = new FormData(form);
            const currentPassword = reset ? "" : data.get("currentPassword");
            const newPassword = data.get("newPassword");
            if (typeof currentPassword !== "string" || typeof newPassword !== "string") return;
            void state.submit(async () => {
              await onChangePassword({ currentPassword, newPassword });
              if (!reset) notify(labels.passwordChanged);
            }, form);
          }}
        >
          {(["currentPassword", "newPassword"] as const).map((name) => {
            if (reset && name === "currentPassword") return null;
            const isNew = name === "newPassword";
            const showPassword = visiblePasswords[name];
            return (
              <div key={name} className="grid gap-2">
                <label htmlFor={`${id}-${name}`}>{labels[name]}</label>
                <div className="relative">
                  <input
                    id={`${id}-${name}`}
                    name={name}
                    type={showPassword ? "text" : "password"}
                    autoComplete={isNew ? "new-password" : "current-password"}
                    autoCapitalize="none"
                    spellCheck={false}
                    className={cn(inputClass, "pr-12")}
                    minLength={isNew ? minLength : undefined}
                    maxLength={isNew ? maxLength : undefined}
                    required
                    readOnly={state.pending}
                    aria-describedby={
                      isNew
                        ? state.failed
                          ? `${id}-hint ${id}-error`
                          : `${id}-hint`
                        : state.failed
                          ? `${id}-error`
                          : undefined
                    }
                  />
                  <IconTooltip label={showPassword ? labels.hidePassword : labels.showPassword}>
                    <button
                      type="button"
                      onClick={() =>
                        setVisiblePasswords({ ...visiblePasswords, [name]: !showPassword })
                      }
                      disabled={state.pending}
                      aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                      aria-controls={`${id}-${name}`}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </IconTooltip>
                </div>
                {isNew && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                      {labels.passwordHint}
                    </p>
                    {requestResetLink}
                  </div>
                )}
              </div>
            );
          })}
          <p
            id={`${id}-error`}
            role={state.failed ? "alert" : undefined}
            aria-hidden={!state.failed}
            className={cn("text-sm text-destructive", !state.failed && "invisible")}
          >
            {reset ? labels.resetError : labels.changePasswordError}
          </p>
          <button
            type="submit"
            className={cn(buttonClass, !reset && !fullWidthSubmit && "justify-self-start")}
            disabled={state.pending}
          >
            {state.pending && (
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
            )}
            {state.pending
              ? labels.changingPassword
              : reset
                ? labels.resetSubmit
                : labels.changePassword}
          </button>
        </form>
      )}
    </div>
  );
}

export function ChangePasswordForm(props: ChangePasswordFormProps) {
  return <PasswordForm {...props} />;
}

export function ResetPasswordForm({
  onResetPassword,
  validLink,
  enabled = true,
  loginHref,
  requestResetHref,
  labels: overrides,
  className,
  linkComponent: FormLink = Link,
  minLength,
  maxLength,
}: ResetPasswordFormProps) {
  const labels = { ...passwordLabels, ...overrides };
  const requestResetLink =
    enabled && requestResetHref ? (
      <FormLink href={requestResetHref} className={cn(linkClass, "text-xs")}>
        {labels.requestNewLink}
      </FormLink>
    ) : null;
  return (
    <div className={cn("grid gap-6", className)}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{labels.resetTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {labels.resetDescription}
        </p>
      </div>
      {!enabled ? (
        <output className="text-sm">{labels.resetUnavailable}</output>
      ) : !validLink ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.invalidResetLink}
        </p>
      ) : (
        <PasswordForm
          mode="reset"
          labels={labels}
          minLength={minLength}
          maxLength={maxLength}
          onChangePassword={({ newPassword }) => onResetPassword(newPassword)}
          requestResetLink={requestResetLink}
        />
      )}
      {enabled && !validLink && requestResetLink}
      {loginHref && (
        <FormLink
          href={loginHref}
          className={cn(
            linkClass,
            "min-h-10 justify-self-start rounded-lg px-3 hover:bg-primary/5 hover:no-underline",
          )}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {labels.backToLogin}
        </FormLink>
      )}
    </div>
  );
}

/** Place inside AuthLayout, or the host's existing authentication layout. */
export function ChangePasswordPage({
  className,
  labels: overrides,
  ...props
}: ChangePasswordPageProps) {
  const labels = { ...passwordLabels, ...overrides };
  return (
    <section className={cn("grid gap-6", className)}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{labels.changePasswordTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {labels.changePasswordSubtitle}
        </p>
      </div>
      <PasswordForm {...props} labels={labels} fullWidthSubmit />
    </section>
  );
}

function PasswordForm(props: PasswordFormProps) {
  return (
    <ActionToastProvider>
      <PasswordFormContent {...props} />
    </ActionToastProvider>
  );
}
