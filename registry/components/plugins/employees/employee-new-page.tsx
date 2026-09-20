"use client";
import { useRef, useState, type ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  createEmployeeSchema,
  isEmployeeAdmin,
  type CreateEmployee,
} from "@/components/plugins/employees/schema";
import {
  inputClass,
  primaryButtonClass,
  outlineButtonClass,
} from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";
export interface EmployeeNewPageProps {
  /** Role from the host's authenticated session. Missing or non-admin roles render nothing. */
  currentUserRole: string | null | undefined;
  onCreate: (values: CreateEmployee) => Promise<void>;
  backHref: string;
  labels?: Partial<EmployeeLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}
export function EmployeeNewPage({
  currentUserRole,
  onCreate,
  backHref,
  labels: overrides,
  className,
  linkComponent: EmployeeLink = Link,
}: EmployeeNewPageProps) {
  const labels = { ...employeeLabels, ...overrides };
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  if (!isEmployeeAdmin(currentUserRole)) return null;
  async function submit(data: FormData) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onCreate(createEmployeeSchema.parse(Object.fromEntries(data)));
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <form
      className={cn(
        "mx-auto max-w-lg space-y-5 rounded-3xl border border-border bg-card p-6 text-card-foreground",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <h1 className="text-2xl font-bold">{labels.add}</h1>
      <p className="text-sm text-muted-foreground">{labels.instructions}</p>
      <div className="grid gap-2">
        <label htmlFor="employee-name">{labels.name}</label>
        <input
          className={inputClass}
          id="employee-name"
          name="name"
          autoComplete="name"
          maxLength={200}
          required
          readOnly={pending}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="employee-email">{labels.email}</label>
        <input
          className={inputClass}
          id="employee-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={pending}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="employee-password">{labels.password}</label>
        <input
          className={inputClass}
          id="employee-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          readOnly={pending}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="employee-role">{labels.role}</label>
        <select
          id="employee-role"
          name="role"
          defaultValue="user"
          disabled={pending}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="user">{labels.roleUser}</option>
          <option value="admin">{labels.roleAdmin}</option>
        </select>
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {labels.createError}
        </p>
      )}
      <div className="flex gap-3">
        <button className={primaryButtonClass} type="submit" disabled={pending}>
          {pending ? labels.adding : labels.save}
        </button>
        <EmployeeLink href={backHref} className={outlineButtonClass}>
          {labels.cancel}
        </EmployeeLink>
      </div>
    </form>
  );
}
