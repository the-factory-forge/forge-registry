import { createCustomersAgentOperation } from "@/components/connectors/agents-customers/server";
import { createDriveAgentOperation } from "@/components/connectors/agents-drive/server";
import { createProjectsAgentOperation } from "@/components/connectors/agents-projects/server";
import { AgentsError } from "@/components/plugins/agents/types";
import { customerInputSchema } from "@/components/plugins/customers/inputs";
import { projectInputSchema } from "@/components/plugins/projects/inputs";
import type { Project } from "@/components/plugins/projects/types";
import { directoryQuerySchema } from "@/components/utils/database";
import type { PreviewOperation } from "@/showroom/plugin-agent-client";
import type { usePluginsPreview } from "@/showroom/plugins-preview";

export function directoryAgentOperations(
  state: ReturnType<typeof usePluginsPreview>,
): PreviewOperation[] {
  const customer = (id: string) => {
    const row = state.customers.find((row) => row.id === id);
    if (!row) throw new AgentsError("NOT_FOUND");
    return structuredClone(row);
  };
  const project = (id: string) => {
    const row = state.projects.find((row) => row.id === id);
    if (!row) throw new AgentsError("NOT_FOUND");
    return projectRecord(row);
  };
  function projectRecord(row: Project) {
    return {
      ...row,
      description: row.description ?? null,
      url: null,
      posterImage: row.posterImage ?? null,
      assigneeId: row.assigneeId ?? null,
    };
  }
  async function mutate() {
    if (!state.showActions) throw new AgentsError("FORBIDDEN");
    await state.beforeAction();
  }
  function page<T extends { name: string }>(rows: T[], raw: unknown) {
    const { search, cursor, pageSize } = directoryQuerySchema.parse(raw);
    const matching = rows
      .filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      items: matching.slice(cursor, cursor + pageSize),
      nextCursor: matching.length > cursor + pageSize ? String(cursor + pageSize) : undefined,
    };
  }
  const customers = createCustomersAgentOperation<undefined>({
    authorize: async () => true,
    client: () => ({
      list: async (query) => page(state.customers, query),
      get: async (id) => customer(id),
      async create(raw) {
        await mutate();
        const values = customerInputSchema.parse(raw);
        if (state.customers.some((row) => row.email === values.email))
          throw new AgentsError("INVALID");
        const row = { ...values, id: crypto.randomUUID(), emailVerified: false };
        state.setCustomers((rows) => [...rows, row]);
        return { customer: row, invitationSent: true };
      },
      async update(id, raw) {
        await mutate();
        const values = customerInputSchema.parse(raw);
        const before = customer(id);
        if (state.customers.some((row) => row.id !== id && row.email === values.email))
          throw new AgentsError("INVALID");
        const row = {
          ...before,
          ...values,
          emailVerified: before.email === values.email && before.emailVerified,
        };
        state.setCustomers((rows) => rows.map((current) => (current.id === id ? row : current)));
        return row;
      },
      async setVerified(id, emailVerified) {
        await mutate();
        const row = { ...customer(id), emailVerified };
        state.setCustomers((rows) => rows.map((current) => (current.id === id ? row : current)));
        return row;
      },
      async remove(id) {
        await mutate();
        customer(id);
        if (state.projects.some((row) => row.ownerId === id)) throw new AgentsError("FORBIDDEN");
        state.setCustomers((rows) => rows.filter((row) => row.id !== id));
      },
      async resendInvitation(id) {
        await mutate();
        return { customer: customer(id), invitationSent: true };
      },
    }),
  });
  const projects = createProjectsAgentOperation<undefined>({
    authorize: async () => true,
    client: () => ({
      list: async (ownerId, query) =>
        page(state.projects.filter((row) => row.ownerId === ownerId).map(projectRecord), query),
      get: async (id) => project(id),
      async create(ownerId, raw) {
        await mutate();
        customer(ownerId);
        const row = { ...projectInputSchema.parse(raw), ownerId, id: crypto.randomUUID() };
        state.setProjects((rows) => [...rows, row]);
        return projectRecord(row);
      },
      async update(id, raw) {
        await mutate();
        const row = { ...project(id), ...projectInputSchema.parse(raw) };
        state.setProjects((rows) => rows.map((current) => (current.id === id ? row : current)));
        return row;
      },
      async setStatus(id, status) {
        await mutate();
        const row = { ...project(id), status: projectInputSchema.shape.status.parse(status) };
        state.setProjects((rows) => rows.map((current) => (current.id === id ? row : current)));
        return row;
      },
      async remove(id) {
        await mutate();
        project(id);
        state.driveMock.assertEmpty({ type: "project", id });
        state.setProjects((rows) => rows.filter((row) => row.id !== id));
      },
    }),
  });
  const drive = createDriveAgentOperation<undefined>({
    authorize: async () => state.showDrive,
    client: () => state.driveClient,
    transferUpload: state.driveMock.transfer,
    entry: async (_context, input) => {
      await state.driveClient.listEntries({ scope: input.scope, parentId: null });
      return state.driveMock.entry(input.scope, input.entryId);
    },
    renameSpace: async (_context, scope, name) => {
      await mutate();
      await state.renameDriveSpace(scope, name);
    },
    space: async (_context, scope) => {
      if (scope.type !== "project") throw new AgentsError("FORBIDDEN");
      return project(scope.id);
    },
  });
  for (const operation of [customers, projects]) {
    for (const tool of operation.tools)
      if (tool.kind === "write") tool.authorize = async () => state.showActions;
  }
  return [customers, projects, drive];
}
