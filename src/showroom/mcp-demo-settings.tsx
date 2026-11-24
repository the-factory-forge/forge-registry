import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import {
  accountButtonClass,
  accountInputClass,
  accountPrimaryClass,
} from "@/components/plugins/auth/account-styles";
import { cn } from "@/components/utils/cn";

const server = import.meta.env.VITE_MCP_DEMO_URL ?? "http://127.0.0.1:3222";
const stateSchema = z.object({
  resource: z.literal(`${server}/mcp`),
  expiresAt: z.string().nullable(),
  articles: z.array(z.object({ id: z.string(), title: z.string() })),
  events: z.array(z.object({ tool: z.string(), outcome: z.string(), at: z.string() })),
});
const keySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/),
  expiresAt: z.string(),
  resource: z.literal(`${server}/mcp`),
});

async function readState(signal: AbortSignal) {
  const response = await fetch(`${server}/demo/state`, {
    signal,
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unavailable demo");
  const value = stateSchema.parse(await response.json());
  signal.throwIfAborted();
  return value;
}

export function McpDemoSettings() {
  const id = `factory-mcp-demo-${useId()}`;
  const [state, setState] = useState<z.infer<typeof stateSchema>>();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void readState(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Start the local MCP demo, then retry.");
      });
    return () => request.current?.abort();
  }, []);
  async function run(method?: "POST" | "DELETE") {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (method) {
        const response = await fetch(`${server}/demo/key`, {
          method,
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
          ...(method === "POST"
            ? { headers: { "Content-Type": "application/json" }, body: "{}" }
            : {}),
        });
        if (!response.ok) throw new Error("Key request failed");
        const value = method === "POST" ? keySchema.parse(await response.json()) : null;
        controller.signal.throwIfAborted();
        setSecret(value?.token ?? "");
        setFeedback(value ? "Key created. Copy it before closing Settings." : "Key revoked.");
      }
      setState(await readState(controller.signal));
    } catch {
      if (!controller.signal.aborted)
        setError("The local MCP demo did not respond. Check the server and retry.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("Copied.");
    } catch {
      setError("Copy failed. Select and copy the text manually.");
    }
  }
  const prompt = `Test the disposable Forge Registry MCP demo at ${server}/mcp using the temporary Bearer key I provide separately. No AI provider key is required by this server.
Discover the tool schemas. Use blogs_list with {"locale":"en","page":1,"pageSize":12}, then blogs_get to read an article.
Create one draft titled "MCP check <unique suffix>" with blogs_create. Read its returned ID with blogs_get. Use blogs_save to change its title and Markdown, preserving its other fields and using its current version. Read it back and verify both changes. Delete only the article you created with blogs_delete and its latest version, then confirm it is absent.
Each write first returns a proposal: show its complete preview, then call agents_execute with the proposalId and unchanged preview as review. You are authorized to execute these three changes on your disposable test article. Use a new requestId for each intended change; retry only an identical request. Stop on an unresolved outcome. Leave existing articles unchanged.
Report each step, the created ID, the final deletion check and any errors. Never print the key or save it in a file, log or repository. Use a local MCP or HTTP client; ask me before changing persistent client configuration.`;
  return (
    <section aria-label="Local MCP demo" className="space-y-5 text-sm">
      <p className="text-muted-foreground">
        Connect your agent to sample Blogs. No AI key needed. Temporary access lasts one hour.
      </p>
      <div className="space-y-2">
        <label htmlFor={`${id}-url`} className="font-medium">
          MCP URL
        </label>
        <div className="flex gap-2">
          <input id={`${id}-url`} readOnly value={`${server}/mcp`} className={accountInputClass} />
          <button
            type="button"
            aria-label="Copy MCP URL"
            className={accountButtonClass}
            onClick={() => void copy(`${server}/mcp`)}
          >
            <CopyIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Streamable HTTP · Bearer token · This Mac only
        </p>
      </div>
      {state?.expiresAt && (
        <p>
          Active key expires at{" "}
          <time dateTime={state.expiresAt}>
            {new Date(state.expiresAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          .
        </p>
      )}
      {secret && (
        <div className="space-y-2">
          <label htmlFor={`${id}-key`} className="font-medium">
            Temporary key
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-key`}
              readOnly
              type="password"
              autoComplete="off"
              value={secret}
              className={accountInputClass}
            />
            <button
              type="button"
              aria-label="Copy temporary key"
              className={accountButtonClass}
              onClick={() => void copy(secret)}
            >
              <CopyIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(accountButtonClass, accountPrimaryClass)}
          disabled={busy || !state}
          onClick={() => void run("POST")}
        >
          {secret ? "Replace key" : "Create temporary key"}
        </button>
        {state?.expiresAt && (
          <button
            type="button"
            className={accountButtonClass}
            disabled={busy}
            onClick={() => void run("DELETE")}
          >
            Revoke key
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Creating a key replaces the previous one. Closing Settings hides the key.
      </p>
      {error && (
        <div role="alert" className="space-y-2 text-destructive">
          <p>{error}</p>
          <code className="block text-xs">pnpm demo:mcp</code>
          <button
            type="button"
            className={accountButtonClass}
            disabled={busy}
            onClick={() => void run()}
          >
            Retry
          </button>
        </div>
      )}
      <output className="block min-h-5 text-muted-foreground">
        {busy ? "Updating…" : feedback}
      </output>
      <details>
        <summary className="cursor-pointer font-medium">Prompt for your agent</summary>
        <div className="mt-3 space-y-3">
          <button type="button" className={accountButtonClass} onClick={() => void copy(prompt)}>
            Copy test prompt
          </button>
          <pre className="max-h-48 overflow-auto text-xs break-words whitespace-pre-wrap">
            {prompt}
          </pre>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">MCP test records</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Server samples, separate from the Blogs browser preview. Restarting the MCP server
            resets them.
          </p>
          <button
            type="button"
            className={accountButtonClass}
            disabled={busy}
            onClick={() => void run()}
          >
            <RefreshCwIcon className="size-4" aria-hidden="true" />
            Refresh results
          </button>
          <ul aria-label="MCP articles" className="space-y-2">
            {state?.articles.map((article) => (
              <li key={article.id} className="break-words">
                {article.title}
              </li>
            ))}
          </ul>
          {state?.events.length ? (
            <ol aria-label="Recent MCP calls" className="space-y-1 text-xs text-muted-foreground">
              {state.events.slice(-5).map((event, i) => (
                <li key={i}>
                  {event.tool}: {event.outcome}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </details>
    </section>
  );
}
