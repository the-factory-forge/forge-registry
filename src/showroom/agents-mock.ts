import {
  AgentsError,
  type AgentAttachment,
  type AgentConversation,
  type AgentOperation,
  type AgentsClient,
  type AgentModelSettings,
  type AgentsSettingsClient,
} from "@/components/plugins/agents/types";

const operations: AgentOperation[] = [
  "Blogs",
  "Employees",
  "Customers",
  "Projects",
  "Drive",
  "Menus",
  "Reservations",
].map((label) => ({
  id: label.toLowerCase(),
  label,
  description: `Work with ${label.toLowerCase()}.`,
}));
operations.push({
  id: "review",
  label: "Example workflow",
  description: "A host-defined operation can combine selected plugin tools.",
});
operations[0].attachmentOptions = [
  { label: "Thumbnail", crop: { width: 1200, height: 900 } },
  { label: "Banner", crop: { width: 1600, height: 900 } },
  { label: "Article image" },
];
operations[1].attachmentOptions = [{ label: "Employee photo", crop: { width: 512, height: 512 } }];
type State = {
  chats: Record<string, AgentConversation>;
  files: Record<string, { conversationId: string; attachment: AgentAttachment }>;
  names: Record<string, string>;
  connection?: AgentModelSettings;
};
const storageKey = "forge-agents-preview-v1";
function fileStorage(id: string, value?: Blob | null): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(storageKey, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("files", value === undefined ? "readonly" : "readwrite");
      const store = tx.objectStore("files");
      const request =
        value === undefined
          ? store.get(id)
          : value === null
            ? store.delete(id)
            : store.put(value, id);
      let result: Blob | undefined;
      request.onsuccess = () => {
        result = request.result instanceof Blob ? request.result : undefined;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
export function createAgentsMock(basePath = "/en/agents") {
  let state: State | null = null;
  let settings = { fail: false, readOnly: false };
  const requests = new Set<string>();
  const load = () => {
    if (!state) {
      try {
        state = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as State | null;
      } catch {
        /* A cleared browser session starts a new preview. */
      }
      state ??= { chats: {}, files: {}, names: {} };
      for (const chat of Object.values(state.chats)) chat.running = false;
    }
    return state;
  };
  const save = () => sessionStorage.setItem(storageKey, JSON.stringify(load()));
  const get = (id: string) => {
    const chat = load().chats[id];
    if (!chat) throw new AgentsError("NOT_FOUND");
    return chat;
  };
  const client: AgentsClient = {
    async operations() {
      return operations;
    },
    async list(operationId) {
      return structuredClone(
        Object.values(load().chats)
          .filter((chat) => chat.operationId === operationId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
    async create(operationId) {
      if (settings.fail) throw new AgentsError("RUNTIME");
      if (!operations.some((operation) => operation.id === operationId))
        throw new AgentsError("FORBIDDEN");
      const chat: AgentConversation = {
        id: crypto.randomUUID(),
        operationId,
        title: "",
        updatedAt: new Date().toISOString(),
        messages: [],
        actions: [],
        running: false,
        canResume: false,
      };
      load().chats[chat.id] = chat;
      save();
      return structuredClone(chat);
    },
    async get(id) {
      return structuredClone(get(id));
    },
    async remove(id) {
      if (settings.fail) throw new AgentsError("STORAGE");
      const chat = get(id);
      if (chat.running) throw new AgentsError("BUSY");
      for (const [fileId, file] of Object.entries(load().files))
        if (file.conversationId === id) {
          await fileStorage(fileId, null);
          delete load().files[fileId];
        }
      delete load().chats[id];
      save();
    },
    async *send(input, signal) {
      const chat = get(input.conversationId);
      if (requests.has(input.requestId)) return;
      if (chat.running) throw new AgentsError("BUSY");
      if (chat.actions.some((action) => action.status === "pending"))
        throw new AgentsError("PENDING");
      requests.add(input.requestId);
      if (!input.resume) {
        const attachments = input.attachmentIds.map((id) => {
          const file = load().files[id];
          if (!file || file.conversationId !== chat.id) throw new AgentsError("NOT_FOUND");
          return file.attachment;
        });
        chat.messages.push({
          id: crypto.randomUUID(),
          role: "user",
          text: input.text,
          attachments,
        });
        chat.title ||= input.text.slice(0, 80) || attachments[0]?.name || "New conversation";
      }
      chat.running = true;
      chat.canResume = false;
      chat.updatedAt = new Date().toISOString();
      save();
      yield { type: "conversation", conversation: structuredClone(chat) };
      const answer = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "",
        attachments: [],
      };
      try {
        if (settings.fail) throw new AgentsError("RUNTIME");
        const reading = /^list\b|^show\b/i.test(input.text);
        const text = input.resume
          ? "The previous decision is saved. What would you like to do next?"
          : reading
            ? `The sample record is “${load().names[chat.operationId] ?? "Sample record"}”. No records were changed.`
            : "Review the proposed change below. The sample record changes only after you approve.";
        if (load().connection) {
          answer.text = `Demo model: ${load().connection!.model}. `;
          yield { type: "text", text: answer.text };
        }
        chat.messages.push(answer);
        for (const part of text.match(/.{1,12}/g) ?? []) {
          signal.throwIfAborted();
          await new Promise((resolve) => setTimeout(resolve, 50));
          signal.throwIfAborted();
          answer.text += part;
          save();
          yield { type: "text", text: part };
        }
        if (!input.resume && !reading) {
          if (settings.readOnly) throw new AgentsError("FORBIDDEN");
          chat.actions.push({
            id: crypto.randomUUID(),
            messageId: answer.id,
            preview: {
              title: "Update sample record",
              target: operations.find((operation) => operation.id === chat.operationId)!.label,
              changes: [
                {
                  label: "Name",
                  before: load().names[chat.operationId] ?? "Sample record",
                  after: input.text || "Attached image",
                },
              ],
              effects: ["Updates the showroom's sample record only."],
              attachmentIds: input.attachmentIds,
            },
            status: "pending",
          });
        }
      } catch (error) {
        chat.canResume = true;
        if (!signal.aborted) throw error;
      } finally {
        chat.running = false;
        save();
      }
    },
    async decide(input) {
      const chat = get(input.conversationId);
      const action = chat.actions.find((action) => action.id === input.actionId);
      if (!action) throw new AgentsError("NOT_FOUND");
      if (action.status !== "pending") return structuredClone(chat);
      if (input.approve && settings.readOnly) throw new AgentsError("FORBIDDEN");
      if (settings.fail) throw new AgentsError("RUNTIME");
      action.status = input.approve ? "succeeded" : "rejected";
      if (input.approve) {
        load().names[chat.operationId] = action.preview.changes[0].after;
        action.result = "Sample record updated.";
        action.resultHref = `${basePath}?${new URLSearchParams({
          operation: chat.operationId,
          conversation: chat.id,
          record: chat.operationId,
        })}`;
      }
      chat.canResume = true;
      save();
      return structuredClone(chat);
    },
    async attach(conversationId, file) {
      get(conversationId);
      if (settings.fail) throw new AgentsError("STORAGE");
      if (!file.size || file.size > 25 * 1024 * 1024) throw new AgentsError("LIMIT");
      const attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      };
      await fileStorage(attachment.id, file);
      load().files[attachment.id] = { conversationId, attachment };
      save();
      return attachment;
    },
    async attachment(conversationId, id) {
      get(conversationId);
      if (load().files[id]?.conversationId !== conversationId) throw new AgentsError("NOT_FOUND");
      const blob = await fileStorage(id);
      if (!blob) throw new AgentsError("NOT_FOUND");
      return blob;
    },
  };
  const modelSettings: AgentsSettingsClient = {
    async get() {
      if (settings.readOnly) throw new AgentsError("FORBIDDEN");
      if (settings.fail) throw new AgentsError("RUNTIME");
      return load().connection ?? null;
    },
    async models({ provider, token }) {
      if (settings.readOnly) throw new AgentsError("FORBIDDEN");
      if (settings.fail) throw new AgentsError("RUNTIME");
      if (token !== "demo" && !(token === undefined && load().connection?.provider === provider))
        throw new AgentsError("INVALID");
      return [{ id: `demo-${provider}`, label: `Example ${provider} model` }];
    },
    async save(input) {
      const models = await modelSettings.models(input);
      if (!models.some((model) => model.id === input.model)) throw new AgentsError("INVALID");
      load().connection = { provider: input.provider, model: input.model };
      save();
    },
    async remove() {
      if (settings.readOnly) throw new AgentsError("FORBIDDEN");
      if (settings.fail) throw new AgentsError("RUNTIME");
      delete load().connection;
      save();
    },
  };
  return {
    client,
    settings: modelSettings,
    async record(id: string) {
      const operation = operations.find((operation) => operation.id === id);
      const name = load().names[id];
      return operation && name ? { operation: operation.label, name } : null;
    },
    configure(value: typeof settings) {
      settings = value;
    },
  };
}
