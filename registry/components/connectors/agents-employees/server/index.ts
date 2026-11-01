import { z } from "zod";

import {
  agentId,
  agentRecord,
  agentTools,
  agentOperation,
  agentFile,
  type AgentConnectorOptions,
} from "@/components/plugins/agents/server/tools";
import type { EmployeeDeletionAdapter } from "@/components/plugins/employees/employee-delete-dialog";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesSchema,
  type Employee,
} from "@/components/plugins/employees/schema";
import { createEmployeeService } from "@/components/plugins/employees/server/employees.server";

export interface EmployeesAgentOptions<Context> extends AgentConnectorOptions<
  Context,
  ReturnType<typeof createEmployeeService>
> {
  /** Fresh authorized lookup; return only directory/profile fields. */
  get(context: Context, id: string): Promise<Employee>;
  invitationURL(context: Context): string;
  callbackURL(context: Context): string;
  deletion?(context: Context): EmployeeDeletionAdapter;
  uploadPhoto?(context: Context, id: string, file: File): Promise<void>;
  setWebsitePublished?(context: Context, id: string, published: boolean): Promise<void>;
}
function employee(row: Employee) {
  const {
    id,
    name,
    email,
    role,
    image,
    emailVerified,
    banned,
    mustChangePassword,
    websitePublished,
  } = row;
  return {
    id,
    name,
    email,
    role,
    image,
    emailVerified,
    banned,
    mustChangePassword,
    websitePublished,
  };
}
export function createEmployeesAgentOperation<Context>(options: EmployeesAgentOptions<Context>) {
  const { read, write } = agentTools<Context>();
  const before = async (c: Context, i: { id: string }) => {
    options.client(c);
    return employee(await options.get(c, i.id));
  };
  const tools = [
    read("employees_list", listEmployeesSchema, async (c, i) => {
      const result = await options.client(c).list(i);
      return { ...result, users: result.users.map(employee) };
    }),
    read("employees_get", agentRecord, before),
    write("employees_create", createEmployeeSchema, {
      before: async () => null,
      run: async (c, i) => {
        const result = await options.client(c).create(i, options.invitationURL(c));
        return { user: employee(result.user), invitationSent: result.invitationSent };
      },
      effects: [
        "Creates an account and sends an invitation. Delivery failure keeps the account for resend.",
      ],
    }),
    write("employees_update", updateEmployeeSchema, {
      before,
      run: async (c, i) => employee(await options.client(c).update(i)),
      effects: ["Role changes affect account permissions; changing email clears its verification."],
    }),
    write("employees_send_verification", agentRecord, {
      before,
      run: (c, i) =>
        options.client(c).sendVerification(i, options.callbackURL(c), options.invitationURL(c)),
      effects: ["Sends an invitation or verification email when needed."],
    }),
  ];
  if (options.deletion) {
    tools.push(
      read("employees_deletion_preview", agentRecord, (c, i) =>
        options.deletion!(c).preview([i.id]),
      ),
    );
    tools.push(
      write(
        "employees_delete",
        agentRecord.extend({
          decisions: z.record(
            z.string(),
            z.object({ choice: agentId, replacementId: agentId.optional() }),
          ),
        }),
        {
          before: async (c, i) => ({
            employee: await before(c, i),
            related: await options.deletion!(c).preview([i.id]),
          }),
          run: async (c, i, _files, _requestId, prepared) => {
            const adapter = options.deletion!(c);
            const preview = z
              .object({ before: z.object({ related: z.object({ token: z.string() }) }) })
              .parse(prepared).before.related;
            await adapter.confirm([i.id], preview.token, i.decisions);
          },
          effects: [
            "Deletes the account and applies the displayed related-record decisions atomically.",
          ],
        },
      ),
    );
  } else
    tools.push(
      write("employees_delete", agentRecord, {
        before,
        run: (c, i) => options.client(c).remove(i),
        effects: ["Deletes the employee account using the host's configured retention rules."],
      }),
    );
  if (options.uploadPhoto)
    tools.push(
      write("employees_upload_photo", agentRecord.extend({ attachmentId: agentId }), {
        before,
        attachments: (i) => [i.attachmentId],
        run: async (c, i, files) =>
          options.uploadPhoto!(c, i.id, await agentFile(files, i.attachmentId)),
        effects: ["Replaces the employee photo."],
      }),
    );
  if (options.setWebsitePublished)
    tools.push(
      write("employees_set_website_published", agentRecord.extend({ published: z.boolean() }), {
        before,
        run: (c, i) => options.setWebsitePublished!(c, i.id, i.published),
        effects: ["Changes public website visibility, independently of account access."],
      }),
    );
  return {
    ...agentOperation("employees", "Employees", options.authorize, tools),
    attachmentOptions: [{ label: "Employee photo", crop: { width: 512, height: 512 } }],
  };
}
