"use client";
import { Avatar } from "@base-ui/react/avatar";
import { ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { useState } from "react";

import { ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  EmployeeActions,
  type EmployeeActionCallbacks,
} from "@/components/plugins/employees/employee-actions";
import { EmployeeCreateDialog } from "@/components/plugins/employees/employee-create-dialog";
import { EmployeeWebsiteStatus } from "@/components/plugins/employees/employee-website-status";
import { employeeLabels, type EmployeeLabels } from "@/components/plugins/employees/labels";
import {
  EMPLOYEE_PAGE_SIZE,
  isEmployeeAdmin,
  type CreateEmployee,
  type Employee,
} from "@/components/plugins/employees/schema";
import { TablePagination } from "@/components/table-pagination";
import { matchesTableSearch, TableSearch } from "@/components/table-search";
import { cn } from "@/components/utils/cn";
import {
  tableActionCellClass,
  tableActionHeaderClass,
  tableCellClass,
  tableClass,
  tableHeaderClass,
  tablePanelClass,
  tableRowClass,
} from "@/components/utils/table-styles";
import { retainRemovedItems, useOptimisticAction } from "@/components/utils/use-optimistic-action";
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
  /** For server pagination, filter the full directory before supplying this page. */
  search?: string;
  onSearchChange?: (search: string) => void;
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
function EmployeesPageContent({
  employees: suppliedEmployees,
  search: controlledSearch,
  onSearchChange,
  currentUserId,
  currentUserRole,
  total,
  offset,
  onOffsetChange,
  onCreate,
  loading = false,
  error = false,
  onUpdate,
  onSetWebsitePublished,
  onDelete,
  onSendVerification,
  labels: overrides,
  className,
}: EmployeesPageProps) {
  const [localSearch, setLocalSearch] = useState("");
  const search = controlledSearch ?? localSearch;
  const optimistic = useOptimisticAction(suppliedEmployees, `${currentUserId}:${offset}:${search}`);
  const employees = optimistic.value;
  const visibleTotal = Math.max(0, total + employees.length - suppliedEmployees.length);
  if (!isEmployeeAdmin(currentUserRole)) return null;
  const labels = { ...employeeLabels, ...overrides };
  // ponytail: fallback searches supplied rows; use onSearchChange for server pagination.
  const filteredEmployees = onSearchChange
    ? employees
    : employees.filter((employee) =>
        matchesTableSearch(
          search,
          employee.name,
          employee.email,
          isEmployeeAdmin(employee.role) ? labels.roleAdmin : labels.roleUser,
          employee.banned ? labels.disabled : labels.active,
          employee.emailVerified ? labels.verified : labels.unverified,
        ),
      );
  return (
    <section
      className={cn(tablePanelClass, "mx-auto w-full max-w-7xl px-0", className)}
      aria-label={labels.title}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pb-6">
        <h1 className="font-sans text-base font-semibold">{labels.title}</h1>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <TableSearch
            value={search}
            label={labels.search}
            clearLabel={labels.clearSearch}
            onValueChange={(value) => {
              setLocalSearch(value);
              onSearchChange?.(value);
              if (onSearchChange) onOffsetChange(0);
            }}
          />
          <EmployeeCreateDialog
            currentUserRole={currentUserRole}
            disabled={loading || error || optimistic.pending}
            onCreate={(values) => {
              const employee: Employee = {
                id: `pending-${crypto.randomUUID()}`,
                name: values.name,
                email: values.email,
                role: values.role,
                emailVerified: false,
              };
              return optimistic.run(
                (rows) => [employee, ...rows],
                () => onCreate(values),
              );
            }}
            labels={labels}
          />
        </div>
      </header>
      <div className="px-6">
        <div className="min-w-0 overflow-x-auto">
          <table className={tableClass} aria-busy={loading}>
            {loading && filteredEmployees.length > 0 && (
              <caption className="sr-only">
                <output>{labels.loading}</output>
              </caption>
            )}
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
                <th scope="col" className={tableHeaderClass}>
                  {labels.website}
                </th>
                <th scope="col" className={tableActionHeaderClass}>
                  {labels.actions}
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {retainRemovedItems(filteredEmployees, suppliedEmployees, optimistic.pending).map(
                (employee) => (
                  <tr
                    key={employee.id}
                    hidden={!filteredEmployees.some((row) => row.id === employee.id)}
                    className={tableRowClass}
                  >
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
                        <IconTooltip
                          label={employee.emailVerified ? labels.verified : labels.unverified}
                        >
                          <button
                            type="button"
                            aria-label={
                              employee.emailVerified ? labels.verified : labels.unverified
                            }
                            className={cn(
                              "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8",
                              employee.emailVerified
                                ? "bg-status-success text-status-success-foreground"
                                : "bg-status-pending text-status-pending-foreground",
                            )}
                          >
                            {employee.emailVerified ? (
                              <ShieldCheckIcon className="size-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <ShieldOffIcon className="size-4 shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        </IconTooltip>
                        <span className="max-w-72 truncate" title={employee.email}>
                          {employee.email}
                        </span>
                      </div>
                    </td>
                    <td className={cn(tableCellClass, "whitespace-nowrap")}>
                      {isEmployeeAdmin(employee.role) ? labels.roleAdmin : labels.roleUser}
                    </td>
                    <td className={cn(tableCellClass, "whitespace-nowrap")}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
                          employee.banned
                            ? "bg-status-canceled text-status-canceled-foreground"
                            : "bg-status-success text-status-success-foreground",
                        )}
                      >
                        {employee.banned ? labels.disabled : labels.active}
                      </span>
                    </td>
                    <td className={cn(tableCellClass, "whitespace-nowrap")}>
                      <EmployeeWebsiteStatus
                        published={employee.websitePublished}
                        labels={labels}
                      />
                    </td>
                    <td className={tableActionCellClass}>
                      <EmployeeActions
                        employee={employee}
                        disabled={
                          loading ||
                          error ||
                          optimistic.pending ||
                          employee.id.startsWith("pending-")
                        }
                        currentUserId={currentUserId}
                        labels={labels}
                        onSetWebsitePublished={
                          onSetWebsitePublished
                            ? (id, published) =>
                                optimistic.run(
                                  (rows) =>
                                    rows.map((row) =>
                                      row.id === id ? { ...row, websitePublished: published } : row,
                                    ),
                                  () => onSetWebsitePublished(id, published),
                                )
                            : undefined
                        }
                        onUpdate={(values) =>
                          optimistic.run(
                            (rows) =>
                              rows.map((row) =>
                                row.id === values.id
                                  ? {
                                      ...row,
                                      ...values,
                                      emailVerified:
                                        row.email === values.email && row.emailVerified,
                                    }
                                  : row,
                              ),
                            () => onUpdate(values),
                          )
                        }
                        onDelete={(id) =>
                          optimistic.run(
                            (rows) => rows.filter((row) => row.id !== id),
                            () => onDelete(id),
                          )
                        }
                        onSendVerification={onSendVerification}
                      />
                    </td>
                  </tr>
                ),
              )}
              {((error && !loading) || optimistic.error || filteredEmployees.length === 0) && (
                <tr>
                  <td colSpan={6} className={cn(tableCellClass, "py-8")}>
                    {(error && !loading) || optimistic.error ? (
                      <p role="alert" className="text-destructive">
                        {error ? labels.error : labels.updateError}
                      </p>
                    ) : (
                      <output className="text-muted-foreground">
                        {loading ? labels.loading : search.trim() ? labels.noMatches : labels.empty}
                      </output>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          disabled={loading || error || optimistic.pending}
          summary={`${visibleTotal} ${labels.total}`}
          page={Math.floor(offset / EMPLOYEE_PAGE_SIZE) + 1}
          pageCount={Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE))}
          label={labels.title}
          previousLabel={labels.previous}
          nextLabel={labels.next}
          previousDisabled={offset <= 0}
          nextDisabled={offset + EMPLOYEE_PAGE_SIZE >= total}
          onPrevious={() => onOffsetChange(Math.max(0, offset - EMPLOYEE_PAGE_SIZE))}
          onNext={() => onOffsetChange(offset + EMPLOYEE_PAGE_SIZE)}
        />
      </div>
    </section>
  );
}

export function EmployeesPage(props: EmployeesPageProps) {
  return (
    <ActionToastProvider>
      <EmployeesPageContent {...props} />
    </ActionToastProvider>
  );
}
