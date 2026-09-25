"use client";
import { Avatar } from "@base-ui/react/avatar";
import { ChevronLeftIcon, ChevronRightIcon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";

import {
  EmployeeActions,
  type EmployeeActionCallbacks,
} from "@/components/plugins/employees/employee-actions";
import { EmployeeCreateDialog } from "@/components/plugins/employees/employee-create-dialog";
import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  EMPLOYEE_PAGE_SIZE,
  isEmployeeAdmin,
  type CreateEmployee,
  type Employee,
} from "@/components/plugins/employees/schema";
import { outlineButtonClass } from "@/components/plugins/employees/styles";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableCellClass,
  tableClass,
  tableFooterClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
export { EmployeeCreateDialog } from "@/components/plugins/employees/employee-create-dialog";
export type {
  Employee,
  CreateEmployee,
  UpdateEmployee,
  VerificationResult,
} from "@/components/plugins/employees/schema";
export type { EmployeeLabels } from "@/components/plugins/employees/labels";
export interface EmployeesPageProps extends EmployeeActionCallbacks {
  employees: readonly Employee[];
  currentUserId: string;
  /** Role from the host's authenticated session. Missing or non-admin roles render nothing. */
  currentUserRole: string | null | undefined;
  total: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onCreate: (values: CreateEmployee) => Promise<void>;
  loading?: boolean;
  error?: boolean;
  labels?: Partial<EmployeeLabels>;
  className?: string;
}
export function EmployeesPage({
  employees,
  currentUserId,
  currentUserRole,
  total,
  offset,
  onOffsetChange,
  onCreate,
  loading = false,
  error = false,
  onUpdate,
  onDelete,
  onSendVerification,
  labels: overrides,
  className,
}: EmployeesPageProps) {
  if (!isEmployeeAdmin(currentUserRole)) return null;
  const labels = { ...employeeLabels, ...overrides };
  return (
    <section
      className={cn(tablePanelClass, "mx-auto w-full max-w-7xl px-0", className)}
      aria-label={labels.title}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pb-6">
        <h1 className="font-sans text-base font-semibold">{labels.title}</h1>
        <EmployeeCreateDialog
          currentUserRole={currentUserRole}
          onCreate={onCreate}
          labels={labels}
        />
      </header>
      <div className="px-6">
        {loading ? (
          <output>{labels.loading}</output>
        ) : error ? (
          <p role="alert" className="text-destructive">
            {labels.error}
          </p>
        ) : (
          <>
            <div className="min-w-0 overflow-x-auto">
              <table className={tableClass}>
                <thead className="[&_tr]:border-b">
                  <tr className={tableRowClass}>
                    <th scope="col" className={tableHeaderClass}>
                      {labels.name}
                    </th>
                    <th scope="col" className={tableHeaderClass}>
                      {labels.email}
                    </th>
                    <th scope="col" className={tableHeaderClass}>
                      {labels.role}
                    </th>
                    <th scope="col" className={tableHeaderClass}>
                      {labels.status}
                    </th>
                    <th scope="col" className={tableActionCellClass}>
                      {labels.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {employees.map((employee) => (
                    <tr key={employee.id} className={tableRowClass}>
                      <td
                        aria-label={employee.name}
                        className={cn(tableCellClass, "whitespace-nowrap")}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar.Root className="relative flex size-8 shrink-0 overflow-hidden rounded-full bg-primary/20">
                            <Avatar.Image
                              className="size-full object-cover"
                              src={employee.image ?? undefined}
                              alt=""
                            />
                            <Avatar.Fallback className="flex size-full items-center justify-center text-xs">
                              {employee.name
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part.charAt(0))
                                .join("")
                                .toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span className="max-w-48 truncate font-medium" title={employee.name}>
                            {employee.name}
                          </span>
                        </div>
                      </td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>
                        <div className="flex items-center gap-3">
                          <span
                            role="img"
                            aria-label={
                              employee.emailVerified ? labels.verified : labels.unverified
                            }
                            title={employee.emailVerified ? labels.verified : labels.unverified}
                            className={
                              employee.emailVerified
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            }
                          >
                            {employee.emailVerified ? (
                              <ShieldCheckIcon className="size-4" aria-hidden="true" />
                            ) : (
                              <ShieldOffIcon className="size-4" aria-hidden="true" />
                            )}
                          </span>
                          <span className="max-w-72 truncate" title={employee.email}>
                            {employee.email}
                          </span>
                        </div>
                      </td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>
                        {isEmployeeAdmin(employee.role) ? labels.roleAdmin : labels.roleUser}
                      </td>
                      <td className={cn(tableCellClass, "whitespace-nowrap")}>
                        {employee.banned ? labels.disabled : labels.active}
                      </td>
                      <td className={tableActionCellClass}>
                        <EmployeeActions
                          employee={employee}
                          currentUserId={currentUserId}
                          labels={labels}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                          onSendVerification={onSendVerification}
                        />
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr className={tableRowClass}>
                      <td colSpan={5} className={tableCellClass}>
                        {labels.empty}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className={tableFooterClass}>
              <span className="text-sm text-muted-foreground">
                {total} {labels.total}
              </span>
              <button
                type="button"
                className={outlineButtonClass}
                disabled={offset === 0}
                onClick={() => onOffsetChange(offset - EMPLOYEE_PAGE_SIZE)}
                aria-label={labels.previous}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </button>
              <span className="min-w-9 text-center text-sm text-muted-foreground tabular-nums">
                {offset / EMPLOYEE_PAGE_SIZE + 1}/
                {Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE))}
              </span>
              <button
                type="button"
                className={outlineButtonClass}
                disabled={offset + EMPLOYEE_PAGE_SIZE >= total}
                onClick={() => onOffsetChange(offset + EMPLOYEE_PAGE_SIZE)}
                aria-label={labels.next}
              >
                <ChevronRightIcon aria-hidden="true" />
              </button>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
