"use client";

import { ArrowRightIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";

import { Link, type LinkProps } from "@/components/link";
import { loginLabels, type LoginLabels } from "@/components/plugins/login/labels";
import { cn } from "@/components/utils/cn";

export type { LoginLabels } from "@/components/plugins/login/labels";
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}
export interface LoginFormProps {
  onSignIn: (credentials: LoginCredentials) => Promise<void>;
  enabled?: boolean;
  forgotPasswordHref?: string;
  socialProviders?: readonly {
    id: string;
    label: string;
    icon?: ReactNode;
    onSignIn: () => Promise<void>;
  }[];
  labels?: Partial<LoginLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}
const inputClass =
  "h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:text-sm";
const buttonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

export function LoginForm({
  onSignIn,
  enabled = true,
  forgotPasswordHref,
  socialProviders = [],
  labels: overrides,
  className,
  linkComponent: LoginLink = Link,
}: LoginFormProps) {
  const labels = { ...loginLabels, ...overrides };
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const lock = useRef(false);
  async function submit(action: () => Promise<void>) {
    if (lock.current || redirecting || !enabled) return;
    lock.current = true;
    setPending(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <div>
        <p className="mb-3 text-xs font-semibold tracking-widest text-primary! uppercase">
          {labels.teamSpace}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {labels.welcomeBack}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground!">
          {labels.welcomeSubtitle}
        </p>
      </div>

      {!enabled && (
        <output className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
          {labels.unavailable}
        </output>
      )}

      {failed && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {labels.loginError}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const email = data.get("email");
          const password = data.get("password");
          if (typeof email !== "string" || typeof password !== "string") return;
          void submit(async () => {
            await onSignIn({
              email: email.trim(),
              password,
              rememberMe: data.get("rememberMe") === "on",
            });
          });
        }}
        className="grid gap-5"
        aria-busy={pending}
      >
        <div className="grid gap-2">
          <label htmlFor="email">{labels.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            className={inputClass}
            readOnly={pending}
            disabled={!enabled}
            aria-describedby={failed ? "login-error" : undefined}
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="password">{labels.password}</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={cn(inputClass, "pr-12")}
              readOnly={pending}
              disabled={!enabled}
              aria-describedby={failed ? "login-error" : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? labels.hidePassword : labels.showPassword}
              aria-controls="password"
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-lg text-muted-foreground! hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground!">
            <input
              type="checkbox"
              name="rememberMe"
              className="size-4 accent-primary"
              disabled={pending || !enabled}
            />
            {labels.rememberMe}
          </label>
          {forgotPasswordHref && (
            <LoginLink
              href={forgotPasswordHref}
              className="font-medium text-primary hover:underline"
            >
              {labels.forgotPassword}
            </LoginLink>
          )}
        </div>
        <button
          type="submit"
          className={cn(buttonClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
          disabled={pending || !enabled}
        >
          {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
          {pending ? labels.signingIn : labels.signIn}
          {!pending && <ArrowRightIcon className="size-4" />}
        </button>
      </form>

      {socialProviders.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {labels.orDivider}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-3">
            {socialProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={cn(buttonClass, "border border-border bg-background hover:bg-muted")}
                disabled={pending || redirecting || !enabled}
                onClick={() =>
                  void submit(async () => {
                    await provider.onSignIn();
                    setRedirecting(true);
                  })
                }
              >
                {provider.icon}
                {provider.label}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground!">
        {labels.contactAdmin}
      </p>
    </div>
  );
}
