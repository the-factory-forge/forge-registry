import { z } from "zod";

export const employeeRoleSchema = z.enum(["user", "admin"]);

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(8).max(128),
  role: employeeRoleSchema.default("user"),
});

export const listEmployeesSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
});

export const setEmployeeBanSchema = z.object({
  id: z.string().min(1),
  banned: z.boolean(),
});

export const employeeIdSchema = z.object({ id: z.string().min(1) });

export const updateEmployeeSchema = createEmployeeSchema.omit({ password: true }).extend({
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
}
export type VerificationResult = { status: "sent" | "verified" | "unavailable" };
export function isEmployeeAdmin(role: string | null | undefined): boolean {
  return role?.split(",").includes("admin") ?? false;
}
