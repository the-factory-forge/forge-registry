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
  /** Issue an expiring single-use link and await delivery; reject when sending fails. */
  sendInvitation: (employee: Employee, invitationURL: string) => Promise<void>;
  /** Replace provider deletion with the host's atomic retention/account transaction. */
  removeEmployee?: (id: string, decision: unknown) => Promise<void>;
}

export function createEmployeeService({
  api,
  headers,
  actor,
  verificationEnabled,
  sendInvitation,
  removeEmployee,
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
    async create(input: unknown, invitationURL: string) {
      const data = createEmployeeSchema.parse(input);
      if (!verificationEnabled) throw new Error("Email delivery is not configured.");
      const { user } = await api.createUser({
        headers,
        body: { ...data, data: { mustChangePassword: true } },
      });
      try {
        await sendInvitation(user, invitationURL);
        return { user, invitationSent: true };
      } catch {
        // Keep the created account visible so an administrator can retry delivery.
        return { user, invitationSent: false };
      }
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
    async remove(input: unknown, decision?: unknown) {
      const { id } = employeeIdSchema.parse(input);
      if (id === actorId) throw new Error("You cannot delete your own account.");
      if (removeEmployee) await removeEmployee(id, decision);
      else await api.removeUser({ headers, body: { userId: id } });
      return { success: true };
    },
    /** callbackURL must be constructed by the host from its configured origin and validated locale. */
    async sendVerification(
      input: unknown,
      callbackURL: string,
      invitationURL: string,
    ): Promise<VerificationResult> {
      const { id } = employeeIdSchema.parse(input);
      const employee = await api.getUser({ headers, query: { id } });
      if (employee.banned) throw new Error("This account is disabled.");
      if (!employee.mustChangePassword && employee.emailVerified) return { status: "verified" };
      if (!verificationEnabled) return { status: "unavailable" };
      // Authorize the recipient above; forwarding admin cookies would target the admin instead.
      if (employee.mustChangePassword) {
        await sendInvitation(employee, invitationURL);
      } else {
        await api.sendVerificationEmail({ body: { email: employee.email, callbackURL } });
      }
      return { status: "sent" };
    },
  };
}
