"use client";

import { useId, useRef, useState } from "react";

import {
  accountCardClass,
  accountInputClass,
  accountButtonClass,
  accountPrimaryClass,
} from "@/components/plugins/auth/account-styles";
import { cn } from "@/components/utils/cn";

export const emailChangeLabels = {
  title: "Change email",
  description:
    "Confirm the change using the email sent by this site. Your current address stays active until confirmation.",
  email: "New email address",
  submit: "Send confirmation",
  sending: "Sending…",
  sent: "Check your email to confirm the change.",
  error: "Could not request the change. Please try again.",
};
export interface AccountEmailChangeProps {
  email: string;
  /** Host authorizes the signed-in administrator and uses its provider's confirmation flow. */
  onChangeEmail: (email: string) => Promise<void>;
  labels?: Partial<typeof emailChangeLabels>;
  className?: string;
}
export function AccountEmailChange({
  email,
  onChangeEmail,
  labels: overrides,
  className,
}: AccountEmailChangeProps) {
  const labels = { ...emailChangeLabels, ...overrides };
  const id = `factory-email-change-${useId()}`;
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const lock = useRef(false);
  return (
    <form
      className={cn(accountCardClass, "mt-6 grid gap-4", className)}
      aria-busy={status === "pending"}
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          lock.current ||
          !event.currentTarget.reportValidity() ||
          value.trim().toLowerCase() === email.toLowerCase()
        )
          return;
        lock.current = true;
        setStatus("pending");
        try {
          await onChangeEmail(value.trim());
          setStatus("sent");
          setValue("");
        } catch {
          setStatus("error");
        } finally {
          lock.current = false;
        }
      }}
    >
      <h2 className="font-semibold">{labels.title}</h2>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      <label htmlFor={id}>{labels.email}</label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        value={value}
        readOnly={status === "pending"}
        className={accountInputClass}
        onChange={(event) => {
          setValue(event.target.value);
          setStatus("idle");
        }}
      />
      <div className="grid text-sm">
        <p aria-hidden="true" className="invisible col-start-1 row-start-1">
          {labels.error}
        </p>
        <p aria-hidden="true" className="invisible col-start-1 row-start-1">
          {labels.sent}
        </p>
        {status === "error" && (
          <p role="alert" className="col-start-1 row-start-1 text-destructive">
            {labels.error}
          </p>
        )}
        {status === "sent" && <output className="col-start-1 row-start-1">{labels.sent}</output>}
      </div>
      <button
        type="submit"
        disabled={
          status === "pending" ||
          !value.trim() ||
          value.trim().toLowerCase() === email.toLowerCase()
        }
        className={cn(accountButtonClass, accountPrimaryClass, "justify-self-start")}
      >
        {status === "pending" ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
