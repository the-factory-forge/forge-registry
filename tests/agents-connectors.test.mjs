import assert from "node:assert/strict";
import test from "node:test";

import { fixture, send } from "./agents/fixture.mjs";

const names = ["blogs", "employees", "customers", "projects", "drive", "menus", "reservations"];
const factories = {};
for (const name of names)
  factories[name] = Object.values(
    await import(`../registry/components/connectors/agents-${name}/server/index.ts`),
  ).find((value) => typeof value === "function");
const id = "00000000-0000-4000-8000-000000000001";
const entry = {
  id,
  name: "Before",
  kind: "file",
  parentId: null,
  state: "ready",
  updatedAt: "2026-10-31T10:00:00Z",
  size: 3,
  contentType: "text/plain",
};
const values = {
  name: "After",
  email: "person@example.test",
  companyName: "",
  phoneNumber: "",
  street: "",
  city: "",
  addressComplement: "",
};

for (const name of names) {
  await test(`${name}: reads, individual approval, rejection, validation and current authorization`, async () => {
    const calls = [];
    let permitted = true;
    const proxy = new Proxy(
      {},
      {
        get(_target, method) {
          return async (...args) => {
            if (!permitted) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
            calls.push({ method, args });
            if (method === "list") return name === "employees" ? { users: [values], total: 1 } : [];
            if (method === "get") return { ...entry, ...values };
            if (method === "configuration") return { services: [], resources: [], settings: {} };
            if (method === "listSpaces") return { items: [] };
            if (method === "create" && name === "employees")
              return {
                user: { id, ...values, emailVerified: false, apiKey: "must never reach the model" },
                invitationSent: false,
              };
            return { id, ...values };
          };
        },
      },
    );
    const operation = factories[name]({
      client: () => proxy,
      authorize: async () => permitted,
      get: async () => ({ ...entry, ...values }),
      entry: async () => entry,
      invitationURL: () => "https://example.test/invite",
      callbackURL: () => "https://example.test/verified",
    });
    const samples = {
      blogs: {
        read: "blogs_categories",
        readInput: {},
        write: "blogs_create",
        writeInput: { title: "Article", locale: "en" },
        method: "create",
      },
      employees: {
        read: "employees_list",
        readInput: {},
        write: "employees_create",
        writeInput: { name: "Person", email: values.email, role: "user" },
        method: "create",
      },
      customers: {
        read: "customers_list",
        readInput: {},
        write: "customers_create",
        writeInput: values,
        method: "create",
      },
      projects: {
        read: "projects_list",
        readInput: { ownerId: id, query: {} },
        write: "projects_create",
        writeInput: {
          ownerId: id,
          values: { name: "Project", status: "requested", description: "" },
        },
        method: "create",
      },
      drive: {
        read: "drive_list_spaces",
        readInput: {},
        write: "drive_rename",
        writeInput: { scope: { type: "project", id }, entryId: id, name: "After" },
        method: "rename",
      },
      menus: {
        read: "menus_list",
        readInput: {},
        write: "menus_create",
        writeInput: {
          categoryId: id,
          priceMinor: 1000,
          position: 0,
          visible: false,
          soldOut: false,
          imageEntryId: null,
          labelIds: [],
          translations: { en: { name: "Dish", description: "" } },
        },
        method: "create",
      },
      reservations: {
        read: "reservations_configuration",
        readInput: {},
        write: "reservations_book",
        writeInput: {
          serviceId: id,
          startsAt: "2026-11-01T12:00:00Z",
          customer: { name: "Person", email: values.email, phone: "" },
          locale: "en",
        },
        method: "book",
      },
    };
    const sample = samples[name];
    let tool = { name: sample.read, input: sample.readInput };
    const runtime = {
      async *stream({ messages }) {
        if (messages.at(-1).role === "tool") yield { type: "text", text: "Read complete." };
        else yield { type: "tool", ...tool };
      },
    };
    const f = fixture({ operations: [operation], runtime });
    const client = f.client;
    const chat = await client.create(operation.id);
    await send(client, chat.id, "read");
    assert.ok(calls.length);
    tool = { name: sample.write, input: { ...sample.writeInput, forgedField: true } };
    const { chat: proposal } = await send(client, chat.id, "write");
    assert.equal(calls.filter((call) => call.method === sample.method).length, 0);
    const actionId = proposal.actions[0].id;
    await client.decide({ conversationId: chat.id, actionId, approve: true });
    const writes = calls.filter((call) => call.method === sample.method);
    assert.equal(writes.length, 1);
    assert.doesNotMatch(JSON.stringify(writes), /forgedField/);
    if (name === "employees")
      assert.doesNotMatch(JSON.stringify(await client.get(chat.id)), /must never reach/);
    if (name === "blogs" || name === "reservations")
      assert.equal(writes[0].args[0].requestId, actionId);
    const second = await send(client, chat.id, "propose again");
    await client.decide({
      conversationId: chat.id,
      actionId: second.chat.actions.at(-1).id,
      approve: false,
    });
    assert.equal(calls.filter((call) => call.method === sample.method).length, 1);
    tool = { name: sample.write, input: null };
    await assert.rejects(send(client, chat.id, "malformed"), { code: "INVALID" });
    permitted = false;
    await assert.rejects(client.get(chat.id), { code: "FORBIDDEN" });
    assert.equal(calls.filter((call) => call.method === sample.method).length, 1);
  });
}

await test("Drive download URLs are resolved only on a user click and never enter model history", async () => {
  let downloads = 0;
  const operation = factories.drive({
    authorize: async () => true,
    entry: async () => entry,
    client: () => ({
      getDownload: async () => {
        downloads++;
        return { url: "https://storage.example.test/file?secret=do-not-send" };
      },
    }),
  });
  const runtime = {
    async *stream({ messages }) {
      if (messages.at(-1).role === "tool") yield { type: "text", text: "Download ready." };
      else
        yield {
          type: "tool",
          name: "drive_download",
          input: { scope: { type: "project", id }, entryId: id },
        };
    },
  };
  const f = fixture({ operations: [operation], runtime });
  const chat = await f.client.create("drive");
  const result = await send(f.client, chat.id, "download");
  assert.equal(downloads, 0);
  assert.doesNotMatch(JSON.stringify(result.chat), /do-not-send/);
  const link = await f.client.download(
    chat.id,
    result.chat.messages.find((message) => message.download).id,
  );
  assert.equal(downloads, 1);
  assert.match(link.url, /do-not-send/);
  assert.doesNotMatch(JSON.stringify(await f.client.get(chat.id)), /do-not-send/);
});

await test("Drive deletion uses the reviewed token and retains trash behavior", async () => {
  let previews = 0;
  let trashed = 0;
  let deleted = 0;
  const client = {
    previewDelete: async () => {
      previews++;
      return { token: previews <= 2 ? "reviewed" : "different-tree", files: 1, folders: 0 };
    },
    trashEntry: async (input) => {
      assert.equal(input.token, "reviewed");
      trashed++;
    },
    deleteEntry: async () => {
      deleted++;
    },
  };
  const operation = factories.drive({
    authorize: async () => true,
    entry: async () => entry,
    client: () => client,
  });
  let name = "drive_delete";
  const f = fixture({
    operations: [operation],
    runtime: {
      async *stream() {
        yield { type: "tool", name, input: { scope: { type: "project", id }, entryId: id } };
      },
    },
  });
  const chat = await f.client.create("drive");
  await assert.rejects(send(f.client, chat.id, "permanent delete"), { code: "FORBIDDEN" });
  name = "drive_trash";
  const result = await send(f.client, chat.id, "trash instead");
  await f.client.decide({
    conversationId: chat.id,
    actionId: result.chat.actions[0].id,
    approve: true,
  });
  assert.equal(trashed, 1);
  assert.equal(deleted, 0);
  assert.equal(previews, 2);
});

await test("Employee retention confirms the reviewed related-record token without replacing it", async () => {
  let previews = 0;
  let confirmed = 0;
  const operation = factories.employees({
    authorize: async () => true,
    client: () => ({}),
    get: async () => ({ id, ...values }),
    invitationURL: () => "https://example.test/invite",
    callbackURL: () => "https://example.test/verify",
    deletion: () => ({
      preview: async () => {
        previews++;
        return { token: previews <= 2 ? "reviewed" : "changed-related-records", groups: [] };
      },
      confirm: async (_ids, token) => {
        assert.equal(token, "reviewed");
        confirmed++;
      },
    }),
  });
  const f = fixture({
    operations: [operation],
    runtime: {
      async *stream() {
        yield { type: "tool", name: "employees_delete", input: { id, decisions: {} } };
      },
    },
  });
  const chat = await f.client.create("employees");
  const result = await send(f.client, chat.id, "delete");
  await f.client.decide({
    conversationId: chat.id,
    actionId: result.chat.actions[0].id,
    approve: true,
  });
  assert.equal(previews, 2);
  assert.equal(confirmed, 1);
});
