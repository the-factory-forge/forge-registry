import { z } from "zod";

import { sortTableRows } from "@/components/utils/table-sort-state";
import type { TableSort } from "@/components/utils/table-sort-state";

export const employeeRoleSchema = z.enum(["user", "admin"]);

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email()),
  role: employeeRoleSchema.default("user"),
});

export const EMPLOYEE_SORT_FIELDS = ["name", "email", "role", "status", "website"] as const;
export type EmployeeSort = TableSort<(typeof EMPLOYEE_SORT_FIELDS)[number]>;
export const employeeDefaultSort = { field: "name", direction: "asc" } as const;
export const listEmployeesSchema = z.object({
  sort: z
    .object({ field: z.enum(EMPLOYEE_SORT_FIELDS), direction: z.enum(["asc", "desc"]) })
    .optional(),
  offset: z.number().int().nonnegative().default(0),
});

export const setEmployeeBanSchema = z.object({
  id: z.string().min(1),
  banned: z.boolean(),
});

export const employeeIdSchema = z.object({ id: z.string().min(1) });

export const updateEmployeeSchema = createEmployeeSchema.extend({
  id: z.string().min(1),
});

export const EMPLOYEE_PAGE_SIZE = 25;
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;
export type CreateEmployee = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;
export interface Employee {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  image?: string | null;
  emailVerified: boolean;
  banned?: boolean | null;
  mustChangePassword?: boolean | null;
  /** Public-profile publication status supplied by the host, independent of account access. */
  websitePublished?: boolean;
}
export type VerificationResult = { status: "sent" | "verified" | "unavailable" };
export type InvitationResult = { invitationSent: boolean };
export function isEmployeeAdmin(role: string | null | undefined): boolean {
  return role?.split(",").includes("admin") ?? false;
}

export function sortEmployees(rows: readonly Employee[], sort: EmployeeSort = employeeDefaultSort) {
  return sortTableRows(
    rows,
    sort,
    (employee, field) => {
      switch (field) {
        case "name":
          return employee.name;
        case "email":
          return employee.email;
        case "role":
          return isEmployeeAdmin(employee.role) ? "admin" : "user";
        case "status":
          return Number(!!employee.banned);
        case "website":
          return employee.websitePublished === undefined
            ? undefined
            : Number(employee.websitePublished);
      }
    },
    (employee) => employee.id,
  );
}
