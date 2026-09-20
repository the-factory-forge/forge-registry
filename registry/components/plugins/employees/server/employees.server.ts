import {
  createEmployeeSchema,
  employeeIdSchema,
  EMPLOYEE_PAGE_SIZE,
  isEmployeeAdmin,
  listEmployeesSchema,
  setEmployeeBanSchema,
  updateEmployeeSchema,
  type Employee,
  type CreateEmployee,
  type UpdateEmployee,
  type VerificationResult,
} from "@/components/plugins/employees/schema";

/** Structural subset of Better Auth's admin API; the host owns its auth instance. */
export interface EmployeesAuthApi {
  listUsers(input: {
    headers: Headers;
    query: { limit: number; offset: number; sortBy: string; sortDirection: "asc" };
  }): Promise<{ users: Employee[]; total: number }>;
  createUser(input: {
    headers: Headers;
    body: CreateEmployee & { data: { mustChangePassword: boolean } };
  }): Promise<{ user: Employee }>;
  getUser(input: { headers: Headers; query: { id: string } }): Promise<Employee>;
  adminUpdateUser(input: {
    headers: Headers;
    body: {
      userId: string;
      data: { name: string; email: string; role: string; emailVerified?: boolean };
    };
  }): Promise<Employee>;
  banUser(input: { headers: Headers; body: { userId: string } }): Promise<{ user: Employee }>;
  unbanUser(input: { headers: Headers; body: { userId: string } }): Promise<{ user: Employee }>;
  removeUser(input: { headers: Headers; body: { userId: string } }): Promise<unknown>;
  sendVerificationEmail(input: { body: { email: string; callbackURL: string } }): Promise<unknown>;
}
export interface EmployeeActor {
  id: string;
  role?: string | null;
  banned?: boolean | null;
  mustChangePassword?: boolean | null;
}
export interface EmployeeServiceOptions {
  api: EmployeesAuthApi;
  headers: Headers;
  /** A freshly authenticated server session, never client input. Create per request. */
  actor: EmployeeActor | null;
  verificationEnabled: boolean;
}

export function createEmployeeService({
  api,
  headers,
  actor,
  verificationEnabled,
}: EmployeeServiceOptions) {
  if (!actor || actor.banned || actor.mustChangePassword || !isEmployeeAdmin(actor.role)) {
    throw new Error("Administrator access required.");
  }
  const actorId = actor.id;
  return {
    list(input: unknown) {
      const { offset } = listEmployeesSchema.parse(input);
      return api.listUsers({
        headers,
        query: { limit: EMPLOYEE_PAGE_SIZE, offset, sortBy: "name", sortDirection: "asc" },
      });
    },
    async create(input: unknown) {
      const data = createEmployeeSchema.parse(input);
      const { user } = await api.createUser({
        headers,
        body: { ...data, data: { mustChangePassword: true } },
      });
      return user;
    },
    async setBan(input: unknown) {
      const { id, banned } = setEmployeeBanSchema.parse(input);
      const request = { headers, body: { userId: id } };
      const { user } = banned ? await api.banUser(request) : await api.unbanUser(request);
      return user;
    },
    async update(input: unknown) {
      const data: UpdateEmployee = updateEmployeeSchema.parse(input);
      if (data.id === actorId && data.role !== "admin")
        throw new Error("You cannot remove your own administrator access.");
      const employee = await api.getUser({ headers, query: { id: data.id } });
      const email = data.email.toLowerCase();
      return api.adminUpdateUser({
        headers,
        body: {
          userId: data.id,
          data: {
            name: data.name,
            email,
            role: data.role,
            ...(email !== employee.email.toLowerCase() ? { emailVerified: false } : {}),
          },
        },
      });
    },
    async remove(input: unknown) {
      const { id } = employeeIdSchema.parse(input);
      await api.removeUser({ headers, body: { userId: id } });
      return { success: true };
    },
    /** callbackURL must be constructed by the host from its configured origin and validated locale. */
    async sendVerification(input: unknown, callbackURL: string): Promise<VerificationResult> {
      const { id } = employeeIdSchema.parse(input);
      const employee = await api.getUser({ headers, query: { id } });
      if (employee.emailVerified) return { status: "verified" };
      if (!verificationEnabled) return { status: "unavailable" };
      // Authorize the recipient above; forwarding admin cookies would target the admin instead.
      await api.sendVerificationEmail({ body: { email: employee.email, callbackURL } });
      return { status: "sent" };
    },
  };
}
