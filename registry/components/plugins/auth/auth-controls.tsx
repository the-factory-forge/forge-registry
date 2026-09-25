"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";

import { cn } from "@/components/utils/cn";

/** Share one action across mutually exclusive controls, such as password and Google sign-in. */
export function useAuthAction() {
  const lock = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setStatus("pending");
    try {
      await action();
      setStatus("success");
    } catch {
      lock.current = false;
      setStatus("error");
    }
  }
  return {
    run,
    pending: status === "pending",
    failed: status === "error",
    completed: status === "success",
    disabled: status === "pending" || status === "success",
  };
}

export interface AuthControlProps extends Omit<ComponentProps<"button">, "children"> {
  pending?: boolean;
  label?: string;
  pendingLabel?: string;
}

const buttonClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

// Monochrome Google mark follows the host's semantic foreground color.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.97-3.38.97-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Zm-5.61-8.07a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.34-2.59ZM12 5.95c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z" />
    </svg>
  );
}

/** Controlled button; pair with useAuthAction and place failure feedback in the host layout. */
export function GoogleSignInButton({
  pending = false,
  disabled,
  label = "Continue with Google",
  pendingLabel = "Connecting to Google...",
  className,
  ...props
}: AuthControlProps) {
  return (
    <button
      {...props}
      type="button"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(buttonClass, className)}
    >
      {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Shares state and feedback with a surrounding menu or page through useAuthAction. */
export function SignOutButton({
  pending = false,
  disabled,
  label = "Sign out",
  pendingLabel = "Signing out...",
  className,
  ...props
}: AuthControlProps) {
  return (
    <button
      {...props}
      type="button"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(buttonClass, className)}
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOutIcon aria-hidden="true" />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
