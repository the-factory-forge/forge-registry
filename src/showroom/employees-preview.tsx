"use client";
import {
  useId,
  useState,
  useRef,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";

import { createEmployeesAgentOperation } from "@/components/connectors/agents-employees/server";
import { NativeSelect } from "@/components/native-select";
import { AgentsError } from "@/components/plugins/agents/types";
import { EmployeesPage, type Employee } from "@/components/plugins/employees";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesSchema,
} from "@/components/plugins/employees/schema";
import { matchesTableSearch } from "@/components/table-search";
import { PluginWebMcp } from "@/showroom/plugin-webmcp";
import { previewDataNotice, ShowroomPreview } from "@/showroom/showroom-preview";

export function EmployeesPreview() {
  const selectId = `factory-showroom-employees-${useId()}`;
  const [employees, updateEmployees] = useState<Employee[]>([
    {
      id: "admin",
      name: "Alex Morgan",
      email: "alex@example.test",
      role: "admin",
      emailVerified: true,
      websitePublished: true,
    },
    {
      id: "user",
      name: "Sam Rivera",
      email: "sam@example.test",
      role: "user",
      emailVerified: false,
      websitePublished: false,
    },
  ]);
  const rows = useRef(employees);
  const setEmployees: Dispatch<SetStateAction<Employee[]>> = (change) => {
    const next = typeof change === "function" ? change(rows.current) : change;
    rows.current = next;
    updateEmployees(next);
  };
  const [state, setState] = useState("ready");
  const [related, setRelated] = useState(false);
  const [failDeletion, setFailDeletion] = useState(false);
  const [fail, setFail] = useState(false);
  const [failDelivery, setFailDelivery] = useState(false);
  const [role, setRole] = useState("admin");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const filteredEmployees = employees.filter((employee) =>
    matchesTableSearch(search, employee.name, employee.email, employee.role),
  );
  async function beforeAction() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (fail) throw new Error("Preview failure");
  }
  const onUploadPhoto: ComponentProps<typeof EmployeesPage>["onUploadPhoto"] = async (id, file) => {
    await beforeAction();
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Invalid image"));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setEmployees((rows) => rows.map((row) => (row.id === id ? { ...row, image } : row)));
  };
  const deletion: ComponentProps<typeof EmployeesPage>["deletion"] = related
    ? {
        preview: async (ids) => {
          await beforeAction();
          return {
            token: JSON.stringify(ids),
            groups: ids.flatMap((id) => [
              {
                id: `${id}:blogs`,
                label: "Blogs",
                items: [
                  {
                    id: "article",
                    title: "Make room for better ideas",
                    href: "/en/admin/blogs/b1000000-0000-4000-8000-000000000001",
                    status: "Published · EN, FR",
                  },
                ],
                choices: [
                  { id: "keep", label: "Keep articles and their author signature" },
                  { id: "reassign", label: "Reassign articles", requiresReplacement: true },
                  { id: "delete", label: "Delete articles" },
                ],
                replacements: employees
                  .filter((employee) => !ids.includes(employee.id))
                  .map(({ id, name }) => ({ id, name })),
              },
              {
                id: `${id}:pages`,
                label: "Pages (example host plugin)",
                items: [{ id: "page", title: "Studio introduction", status: "Draft" }],
                choices: [
                  { id: "keep", label: "Keep pages" },
                  { id: "delete", label: "Delete pages" },
                ],
              },
            ]),
          };
        },
        confirm: async (ids, token, decisions) => {
          await beforeAction();
          if (failDeletion) throw new Error("Related data changed");
          if (
            token !== JSON.stringify(ids) ||
            ids.includes("admin") ||
            ids.some((id) => !decisions[`${id}:blogs`] || !decisions[`${id}:pages`])
          )
            throw new Error("Reload the preview");
          setEmployees((rows) => rows.filter((row) => !ids.includes(row.id)));
        },
      }
    : undefined;
  const onCreate: ComponentProps<typeof EmployeesPage>["onCreate"] = async (values) => {
    await beforeAction();
    setEmployees((current) => [
      ...current,
      {
        ...values,
        id: crypto.randomUUID(),
        emailVerified: false,
        mustChangePassword: true,
        websitePublished: false,
      },
    ]);
    return { invitationSent: !failDelivery };
  };
  const onUpdate: ComponentProps<typeof EmployeesPage>["onUpdate"] = async (values) => {
    await beforeAction();
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === values.id
          ? {
              ...employee,
              ...values,
              emailVerified: employee.email === values.email && employee.emailVerified,
            }
          : employee,
      ),
    );
  };
  const onSetWebsitePublished: ComponentProps<
    typeof EmployeesPage
  >["onSetWebsitePublished"] = async (id, published) => {
    await beforeAction();
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === id ? { ...employee, websitePublished: published } : employee,
      ),
    );
  };
  const onDelete: ComponentProps<typeof EmployeesPage>["onDelete"] = async (id) => {
    await beforeAction();
    setEmployees((current) => current.filter((employee) => employee.id !== id));
  };
  const onSendVerification: ComponentProps<
    typeof EmployeesPage
  >["onSendVerification"] = async () => {
    await beforeAction();
    return { status: "sent" };
  };
  const get = (id: string) => {
    const row = rows.current.find((row) => row.id === id);
    if (!row) throw new AgentsError("NOT_FOUND");
    return structuredClone(row);
  };
  // The connector stores callbacks without calling the preview client during render.
  // eslint-disable-next-line react-hooks/refs
  const operation = createEmployeesAgentOperation<undefined>({
    authorize: async () => role === "admin",
    get: async (_context, id) => get(id),
    invitationURL: () => "https://example.test/invitation",
    callbackURL: () => "https://example.test/verified",
    deletion: related ? () => deletion! : undefined,
    uploadPhoto: (_context, id, file) => onUploadPhoto!(id, file),
    setWebsitePublished: (_context, id, value) => onSetWebsitePublished!(id, value),
    client: () => ({
      list: async (raw) => {
        const { offset } = listEmployeesSchema.parse(raw);
        return { users: rows.current.slice(offset, offset + 25), total: rows.current.length };
      },
      async create(raw) {
        const ids = new Set(rows.current.map((row) => row.id));
        const result = await onCreate!(createEmployeeSchema.parse(raw));
        const user = rows.current.find((row) => !ids.has(row.id));
        if (!user) throw new AgentsError("UNRESOLVED");
        return { user, invitationSent: result?.invitationSent ?? false };
      },
      async update(raw) {
        const input = updateEmployeeSchema.parse(raw);
        get(input.id);
        if (input.id === "admin" && input.role !== "admin") throw new AgentsError("FORBIDDEN");
        await onUpdate!(input);
        return get(input.id);
      },
      async remove(raw) {
        const id = (raw as { id: string }).id;
        get(id);
        if (id === "admin") throw new AgentsError("FORBIDDEN");
        await onDelete!(id);
        return { success: true };
      },
      setBan: async () => {
        throw new AgentsError("FORBIDDEN");
      },
      sendVerification: async (raw) => {
        const { id } = raw as { id: string };
        get(id);
        return onSendVerification!(id);
      },
    }),
  });
  return (
    <>
      <PluginWebMcp
        operations={[operation]}
        revision={`${role}:${related}`}
        context={{ plugin: "employees", search, offset }}
      />
      <ShowroomPreview
        notice={previewDataNotice}
        controls={
          <>
            <label htmlFor={`${selectId}-role`} className="flex items-center gap-2 text-sm">
              Preview as
              <NativeSelect
                id={`${selectId}-role`}
                className="rounded border bg-background p-2"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="admin">Administrator</option>
                <option value="user">Employee</option>
                <option value="">No role</option>
              </NativeSelect>
            </label>
            <div className="grid gap-2 text-sm">
              <label htmlFor={`${selectId}-state`}>Directory state</label>
              <NativeSelect
                id={`${selectId}-state`}
                value={state}
                onChange={(event) => setState(event.target.value)}
              >
                <option value="ready">Ready</option>
                <option value="loading">Loading</option>
                <option value="empty">Empty</option>
                <option value="error">Error</option>
              </NativeSelect>
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={related}
                onChange={(event) => setRelated(event.target.checked)}
              />
              Review related plugin data
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={fail}
                onChange={(event) => setFail(event.target.checked)}
              />
              Simulate action failures
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={failDeletion}
                onChange={(event) => setFailDeletion(event.target.checked)}
              />
              Fail deletion confirmation
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={failDelivery}
                onChange={(event) => setFailDelivery(event.target.checked)}
              />
              Simulate invitation delivery failure
            </label>
          </>
        }
      >
        {role !== "admin" && (
          <output>The employees dashboard is available to administrators only.</output>
        )}
        <EmployeesPage
          onUploadPhoto={onUploadPhoto}
          deletion={deletion}
          employees={state === "empty" ? [] : filteredEmployees.slice(offset, offset + 25)}
          loading={state === "loading"}
          error={state === "error"}
          total={state === "empty" ? 0 : filteredEmployees.length}
          search={search}
          onSearchChange={setSearch}
          offset={offset}
          onOffsetChange={setOffset}
          currentUserId="admin"
          currentUserRole={role}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onSetWebsitePublished={onSetWebsitePublished}
          onDelete={onDelete}
          onSendVerification={onSendVerification}
        />
      </ShowroomPreview>
    </>
  );
}
