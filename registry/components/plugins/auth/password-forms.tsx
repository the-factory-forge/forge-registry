"use client";

import { ArrowLeftIcon, CheckCircleIcon, LoaderCircleIcon, MailCheckIcon } from "lucide-react";
import { useId, useRef, useState, type ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { passwordLabels, type PasswordLabels } from "@/components/plugins/auth/password-labels";
import { cn } from "@/components/utils/cn";

const inputClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
const buttonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
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
  const id = useId();
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
        <output className="flex items-center gap-3 rounded-xl bg-primary/10 p-4 text-sm">
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
        <FormLink href={loginHref} className={linkClass}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {labels.backToLogin}
        </FormLink>
      )}
    </div>
  );
}

function PasswordForm({
  onChangePassword,
  minLength = 8,
  maxLength = 128,
  labels: overrides,
  className,
  mode = "change",
}: ChangePasswordFormProps & { mode?: "change" | "reset" }) {
  const labels = { ...passwordLabels, ...overrides };
  const id = useId();
  const state = useSubmission();
  const [mismatch, setMismatch] = useState(false);
  const reset = mode === "reset";
  return (
    <div className={cn("grid gap-5", className)}>
      {state.succeeded && (
        <output className="flex items-center gap-3 rounded-xl bg-primary/10 p-4 text-sm">
          <CheckCircleIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {reset ? labels.resetSuccess : labels.passwordChanged}
        </output>
      )}
      {!(reset && state.succeeded) && (
        <form
          className="grid gap-5"
          aria-busy={state.pending}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (state.pending || !form.reportValidity()) return;
            const data = new FormData(form);
            const currentPassword = data.get("currentPassword") ?? "";
            const newPassword = data.get("newPassword");
            if (typeof currentPassword !== "string" || typeof newPassword !== "string") return;
            const matches = newPassword === data.get("confirmPassword");
            setMismatch(!matches);
            if (!matches) {
              form.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.focus();
              return;
            }
            void state.submit(() => onChangePassword({ currentPassword, newPassword }), form);
          }}
        >
          {!reset && (
            <div className="grid gap-2">
              <label htmlFor={`${id}-current`}>{labels.currentPassword}</label>
              <input
                id={`${id}-current`}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                required
                readOnly={state.pending}
                aria-describedby={state.failed ? `${id}-error` : undefined}
              />
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor={`${id}-new`}>{labels.newPassword}</label>
            <input
              id={`${id}-new`}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              minLength={minLength}
              maxLength={maxLength}
              required
              readOnly={state.pending}
              aria-describedby={`${id}-hint`}
              onInput={() => setMismatch(false)}
            />
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              {labels.passwordHint}
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-confirm`}>{labels.confirmPassword}</label>
            <input
              id={`${id}-confirm`}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              minLength={minLength}
              maxLength={maxLength}
              required
              readOnly={state.pending}
              aria-invalid={mismatch}
              aria-describedby={mismatch || state.failed ? `${id}-error` : undefined}
              onInput={() => setMismatch(false)}
            />
          </div>
          {(mismatch || state.failed) && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {mismatch
                ? labels.passwordsMismatch
                : reset
                  ? labels.resetError
                  : labels.changePasswordError}
            </p>
          )}
          <button
            type="submit"
            className={cn(buttonClass, !reset && "justify-self-start")}
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
        />
      )}
      {enabled && requestResetHref && (
        <FormLink href={requestResetHref} className={linkClass}>
          {labels.requestNewLink}
        </FormLink>
      )}
      {loginHref && (
        <FormLink href={loginHref} className={linkClass}>
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
    <section
      className={cn(
        "grid gap-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg sm:p-8",
        className,
      )}
    >
      <div className="grid gap-2 text-center">
        <h1 className="text-2xl font-bold">{labels.changePasswordTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.changePasswordSubtitle}</p>
      </div>
      <ChangePasswordForm {...props} labels={labels} />
    </section>
  );
}
