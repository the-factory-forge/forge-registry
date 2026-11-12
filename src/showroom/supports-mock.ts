import {
  SUPPORT_MAX_IMAGE_BYTES,
  SUPPORT_PAGE_SIZE,
  SupportsError,
  supportCreateSchema,
  supportCommentSchema,
  supportImageType,
  supportQuerySchema,
} from "@/components/plugins/supports/schema";
import type {
  SupportActivity,
  SupportTicket,
  SupportsClient,
  SupportAttachment,
} from "@/components/plugins/supports/types";

export function createSupportsMock() {
  const author = { id: "alex", name: "Alex Morgan" };
  const tickets: SupportTicket[] = Array.from({ length: 23 }, (_, index) => ({
    id: `sample-${index + 1}`,
    title:
      index === 0
        ? "Contact form confirmation is missing"
        : index === 1
          ? "Add opening hours to the contact page"
          : index === 2
            ? "Update the team photo"
            : index === 3
              ? "Change the contact page layout"
              : `Website review ${index + 1}`,
    description:
      index === 0
        ? "The contact form submits, but no confirmation appears.\n\n1. Open the contact page.\n2. Fill in the required fields.\n3. Select **Send**.\n\nExpected: a visible confirmation message."
        : "Please review this part of the website with the maintenance team.",
    type: index % 3 === 0 ? "bug" : index % 3 === 1 ? "feature" : "support",
    status: index === 2 ? "closed" : index === 3 ? "canceled" : "open",
    author,
    attachments: [],
    createdAt: new Date(Date.UTC(2026, 9, 25 - index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 25 - index)).toISOString(),
  }));
  const activity = new Map<string, SupportActivity[]>([
    [
      "sample-1",
      [
        {
          id: "reply-1",
          author: { id: "jordan", name: "Jordan Lee" },
          kind: "comment",
          body: "I can reproduce this on mobile too.",
          status: null,
          attachments: [],
          createdAt: "2026-10-25T10:00:00.000Z",
        },
      ],
    ],
  ]);
  const files = new Map<string, SupportAttachment & { url: string; attached: boolean }>();
  const uploads = new Map<string, string>();
  const mutations = new Map<string, { fingerprint: string; id: string }>();
  const settings = { fail: false, delay: false };
  async function before() {
    if (settings.delay) await new Promise((resolve) => setTimeout(resolve, 700));
    if (settings.fail) throw new SupportsError("STORAGE");
  }
  function find(id: string) {
    const row = tickets.find((entry) => entry.id === id);
    if (!row) throw new SupportsError("NOT_FOUND");
    return row;
  }
  function claim(ids: string[]) {
    return ids.map((id) => {
      const file = files.get(id);
      if (!file || file.attached) throw new SupportsError("CONFLICT");
      return file;
    });
  }
  const client: SupportsClient = {
    async list(input) {
      const { search, page } = supportQuerySchema.parse(input);
      const found = tickets
        .filter((entry) =>
          `${entry.title} ${entry.description}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
      return {
        items: structuredClone(
          found.slice((page - 1) * SUPPORT_PAGE_SIZE, page * SUPPORT_PAGE_SIZE),
        ),
        total: found.length,
      };
    },
    async get(id, cursor = "0") {
      const entries = activity.get(id) ?? [];
      const offset = Number(cursor);
      return structuredClone({
        ticket: find(id),
        activity: entries.slice(offset, offset + 50),
        nextCursor: entries.length > offset + 50 ? String(offset + 50) : undefined,
      });
    },
    async create(raw) {
      await before();
      const input = supportCreateSchema.parse(raw);
      const fingerprint = JSON.stringify(input);
      const previous = mutations.get(input.requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new SupportsError("CONFLICT");
        return structuredClone(find(previous.id));
      }
      const attachments = claim(input.attachmentIds);
      const now = new Date().toISOString();
      const ticket: SupportTicket = {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.description,
        type: input.type,
        status: "open",
        author,
        createdAt: now,
        updatedAt: now,
        attachments: attachments.map(({ id, name, size, contentType }) => ({
          id,
          name,
          size,
          contentType,
        })),
      };
      attachments.forEach((file) => (file.attached = true));
      tickets.unshift(ticket);
      mutations.set(input.requestId, { fingerprint, id: ticket.id });
      return structuredClone(ticket);
    },
    async comment(raw) {
      await before();
      const input = supportCommentSchema.parse(raw);
      const fingerprint = JSON.stringify(input);
      const previous = mutations.get(input.requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new SupportsError("CONFLICT");
        return;
      }
      const row = find(input.id);
      const attachments = claim(input.attachmentIds);
      const now = new Date().toISOString();
      const entry: SupportActivity = {
        id: crypto.randomUUID(),
        author,
        kind: "comment",
        body: input.body,
        status: null,
        createdAt: now,
        attachments: attachments.map(({ id, name, size, contentType }) => ({
          id,
          name,
          size,
          contentType,
        })),
      };
      attachments.forEach((file) => (file.attached = true));
      activity.set(row.id, [...(activity.get(row.id) ?? []), entry]);
      row.updatedAt = now;
      mutations.set(input.requestId, { fingerprint, id: row.id });
    },
    async setStatus(id, status) {
      await before();
      const row = find(id);
      if (row.status === status) return;
      row.status = status;
      row.updatedAt = new Date().toISOString();
      activity.set(id, [
        ...(activity.get(id) ?? []),
        {
          id: crypto.randomUUID(),
          kind: "status",
          status,
          body: "",
          attachments: [],
          author,
          createdAt: row.updatedAt,
        },
      ]);
    },
    async upload({ requestId, file }) {
      await before();
      if (
        file.size > SUPPORT_MAX_IMAGE_BYTES ||
        supportImageType(new Uint8Array(await file.arrayBuffer())) !== file.type
      )
        throw new SupportsError("INVALID");
      const previous = uploads.get(requestId);
      if (previous) {
        const asset = files.get(previous);
        if (!asset) throw new SupportsError("CONFLICT");
        return asset;
      }
      const id = crypto.randomUUID();
      const value = {
        id,
        name: file.name,
        size: file.size,
        contentType: file.type,
        url: URL.createObjectURL(file),
        attached: false,
      };
      files.set(id, value);
      uploads.set(requestId, id);
      return value;
    },
    async cancelUpload(id) {
      const file = files.get(id);
      if (!file) return;
      if (file.attached) throw new SupportsError("CONFLICT");
      URL.revokeObjectURL(file.url);
      files.delete(id);
    },
    async getAttachment(id) {
      const file = files.get(id);
      if (!file) throw new SupportsError("NOT_FOUND");
      return { url: file.url };
    },
  };
  return {
    client,
    setFailures: (value: boolean) => {
      settings.fail = value;
    },
    setDelay: (value: boolean) => {
      settings.delay = value;
    },
    dispose: () => files.forEach((file) => URL.revokeObjectURL(file.url)),
  };
}
