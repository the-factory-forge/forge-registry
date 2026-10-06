"use client";

import * as React from "react";

import { cn } from "@/components/utils/cn";

export type NewsletterProps = Omit<React.ComponentPropsWithoutRef<"section">, "onSubmit"> & {
  title?: string;
  description?: string;
  eyebrow?: string;
  placeholder?: string;
  buttonLabel?: string;
  privacyText?: string;
  loading?: boolean;
  successMessage?: string;
  errorMessage?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  validationErrorMessage?: string;
  submitErrorMessage?: string;
  emailLabel?: string;
  loadingLabel?: string;
  onSubmit: (email: string) => void | Promise<void>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Newsletter({
  title = "Stay in the loop",
  description = "Get product updates and practical tips delivered to your inbox.",
  eyebrow,
  placeholder = "you@example.com",
  buttonLabel = "Subscribe",
  privacyText,
  loading = false,
  successMessage,
  errorMessage,
  disabled = false,
  icon,
  validationErrorMessage = "Please enter a valid email address.",
  submitErrorMessage = "Could not subscribe. Please try again.",
  emailLabel = "Email address",
  loadingLabel = "Subscribing…",
  onSubmit,
  className,
  ...props
}: NewsletterProps) {
  const baseId = `factory-newsletter-${React.useId()}`;
  const inputId = `${baseId}-email`;
  const helperId = `${baseId}-helper`;
  const errorId = `${baseId}-error`;
  const successId = `${baseId}-success`;

  const [email, setEmail] = React.useState("");
  const [validationError, setValidationError] = React.useState<string>();
  const [submitError, setSubmitError] = React.useState<string>();
  const [showStatus, setShowStatus] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const hasError = Boolean(validationError || submitError || (showStatus && errorMessage));
  const inlineError = validationError || submitError || (showStatus ? errorMessage : undefined);
  const inlineSuccess = !inlineError && showStatus ? successMessage : undefined;
  const isLoading = loading || submitting;
  const isDisabled = disabled || isLoading;

  const describedBy = [privacyText ? helperId : undefined, inlineError ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    const normalizedEmail = email.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setShowStatus(false);
      setValidationError(validationErrorMessage);
      return;
    }

    setShowStatus(true);
    setValidationError(undefined);
    setSubmitError(undefined);

    try {
      setSubmitting(true);
      await Promise.resolve(onSubmit(normalizedEmail));
    } catch {
      setSubmitError(submitErrorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className={cn(
        "w-full rounded-xl border border-border bg-background p-5 shadow-sm sm:p-6",
        className,
      )}
      {...props}
    >
      <div className="space-y-2">
        {eyebrow ? (
          <p className="font-eyebrow text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form className="mt-4" onSubmit={handleSubmit} noValidate>
        <label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
          {emailLabel}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setValidationError(undefined);
              setSubmitError(undefined);
              setShowStatus(false);
            }}
            placeholder={placeholder}
            disabled={isDisabled}
            aria-invalid={hasError}
            aria-describedby={describedBy || undefined}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed"
          >
            {isLoading ? loadingLabel : buttonLabel}
          </button>
        </div>

        {privacyText ? (
          <p className="mt-3 text-xs text-muted-foreground" id={helperId}>
            {privacyText}
          </p>
        ) : null}

        {inlineError ? (
          <p
            className="mt-2 text-sm text-destructive"
            id={errorId}
            role="alert"
            aria-live="assertive"
          >
            {inlineError}
          </p>
        ) : null}

        {inlineSuccess ? (
          <p
            className="mt-2 rounded-lg bg-status-success px-3 py-2 text-sm text-status-success-foreground"
            id={successId}
            role="status"
            aria-live="polite"
          >
            {inlineSuccess}
          </p>
        ) : null}
      </form>
    </section>
  );
}
