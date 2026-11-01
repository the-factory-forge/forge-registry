import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  listAgentModels,
  modelCredentials,
  modelSelection,
  streamAgentModel,
} from "@/components/plugins/agents/server/models.server";
import type { AgentRuntime } from "@/components/plugins/agents/server/types";
import {
  AgentsError,
  type AgentModelSettings,
  type AgentsSettingsClient,
} from "@/components/plugins/agents/types";

export interface AgentStoredConnection extends AgentModelSettings {
  encryptedToken: string;
}
export interface AgentsConnectionStore {
  get(): Promise<AgentStoredConnection | null>;
  set(connection: AgentStoredConnection): Promise<void>;
  remove(): Promise<void>;
}
export interface AgentsConnectionOptions<Context> {
  store: AgentsConnectionStore;
  /** A stable, server-only 32-byte key, stored separately from the database. */
  encryptionKey: Uint8Array;
  /** Resolve fresh website-administrator authorization on every settings request. */
  authorize(context: Context): Promise<boolean>;
}

/** One connection per website database. Pass runtime to createAgentsService. */
export function createAgentsModelConnection<Context>(options: AgentsConnectionOptions<Context>) {
  if (options.encryptionKey.byteLength !== 32) throw new AgentsError("INVALID");
  const key = Buffer.from(options.encryptionKey);
  const aad = (value: AgentModelSettings) =>
    Buffer.from(`agents:v1:${value.provider}:${value.model}`);
  function encrypt(token: string, selection: AgentModelSettings) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad(selection));
    const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
  }
  function decrypt(value: AgentStoredConnection) {
    const bytes = Buffer.from(value.encryptedToken, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAAD(aad(value));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  }
  async function credentials(input: { provider: AgentModelSettings["provider"]; token?: string }) {
    if (input.token) return input.token;
    const saved = await options.store.get();
    if (!saved || saved.provider !== input.provider) throw new AgentsError("INVALID");
    return decrypt(saved);
  }
  async function admin<T>(context: Context, action: () => Promise<T>): Promise<T> {
    try {
      if (!(await options.authorize(context))) throw new AgentsError("FORBIDDEN");
      return await action();
    } catch (error) {
      throw error instanceof AgentsError ? error : new AgentsError("RUNTIME");
    }
  }
  const runtime: AgentRuntime = {
    async *stream(input) {
      try {
        const saved = await options.store.get();
        if (!saved) throw new AgentsError("NOT_CONFIGURED");
        const connection = modelSelection.parse({ ...saved, token: decrypt(saved) });
        if (!connection.token) throw new AgentsError("NOT_CONFIGURED");
        yield* streamAgentModel({ ...connection, token: connection.token }, input);
      } catch (error) {
        throw error instanceof AgentsError ? error : new AgentsError("RUNTIME");
      }
    },
  };
  return {
    runtime,
    client(context: Context): AgentsSettingsClient {
      return {
        get: () =>
          admin(context, async () => {
            const saved = await options.store.get();
            return saved ? { provider: saved.provider, model: saved.model } : null;
          }),
        models: (raw) =>
          admin(context, async () => {
            const parsed = modelCredentials.safeParse(raw);
            if (!parsed.success) throw new AgentsError("INVALID");
            return listAgentModels(parsed.data.provider, await credentials(parsed.data));
          }),
        save: (raw) =>
          admin(context, async () => {
            const parsed = modelSelection.safeParse(raw);
            if (!parsed.success) throw new AgentsError("INVALID");
            const { provider, model } = parsed.data;
            const token = await credentials(parsed.data);
            const models = await listAgentModels(provider, token);
            if (!models.some((entry) => entry.id === model)) throw new AgentsError("INVALID");
            if (!(await options.authorize(context))) throw new AgentsError("FORBIDDEN");
            await options.store.set({
              provider,
              model,
              encryptedToken: encrypt(token, { provider, model }),
            });
          }),
        remove: () => admin(context, () => options.store.remove()),
      };
    },
  };
}
