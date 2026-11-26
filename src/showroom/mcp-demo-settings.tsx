import { CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import { IconTooltip } from "@/components/icon-tooltip";
import {
  accountButtonClass,
  accountInputClass,
  accountPrimaryClass,
} from "@/components/plugins/auth/account-styles";
import { cn } from "@/components/utils/cn";
import { destructiveActionClass } from "@/components/utils/destructive-action";

const server = import.meta.env.VITE_MCP_DEMO_URL ?? "http://127.0.0.1:3222";
const exampleResource = "https://intranet.example/api/mcp";
const previewStorage = "forge-mcp-preview-expiry";
const expirySchema = z.iso.datetime();
const stateSchema = z.object({
  resource: z.literal(`${server}/mcp`),
  expiresAt: z.string().nullable(),
});
const keySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/),
  expiresAt: z.string(),
  resource: z.literal(`${server}/mcp`),
});

function previewState(method?: "POST" | "DELETE") {
  if (method === "POST")
    sessionStorage.setItem(previewStorage, new Date(Date.now() + 3_600_000).toISOString());
  if (method === "DELETE") sessionStorage.removeItem(previewStorage);
  const expiry = expirySchema.safeParse(sessionStorage.getItem(previewStorage));
  const expiresAt = expiry.success && Date.parse(expiry.data) > Date.now() ? expiry.data : null;
  return { resource: exampleResource, expiresAt };
}

async function readState(signal: AbortSignal, simulated: boolean) {
  if (simulated) return previewState();
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

export function McpDemoSettings({ simulated = false }: { simulated?: boolean }) {
  const id = `factory-mcp-demo-${useId()}`;
  const resource = simulated ? exampleResource : `${server}/mcp`;
  const [state, setState] = useState<{ resource: string; expiresAt: string | null }>();
  const [secret, setSecret] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void readState(controller.signal, simulated)
      .then((value) => {
        if (!controller.signal.aborted) setState(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            simulated
              ? "Enable browser-session storage, then retry."
              : "Start the local MCP demo, then retry.",
          );
      });
    return () => request.current?.abort();
  }, [simulated]);
  useEffect(() => {
    if (!state?.expiresAt) return;
    const timer = setTimeout(
      () => {
        setState((current) => current && { ...current, expiresAt: null });
        setSecret("");
        setVisible(false);
        setFeedback("Key expired. Create another to continue.");
      },
      Math.max(0, Date.parse(state.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state?.expiresAt]);
  async function run(method?: "POST" | "DELETE") {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (method) {
        let token = "";
        if (simulated) {
          previewState(method);
          if (method === "POST") token = `demo_${crypto.randomUUID()}`;
        } else {
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
          token = value?.token ?? "";
        }
        controller.signal.throwIfAborted();
        setSecret(token);
        setVisible(false);
        setFeedback(token ? "Key created. Copy it before closing Settings." : "Key revoked.");
      }
      setState(await readState(controller.signal, simulated));
    } catch {
      if (!controller.signal.aborted)
        setError(
          simulated
            ? "Enable browser-session storage, then retry."
            : "The local MCP demo did not respond. Check the server and retry.",
        );
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
  return (
    <section
      aria-label={simulated ? "External assistant demo" : "Local MCP demo"}
      className="space-y-5 text-sm"
    >
      <p className="text-muted-foreground">
        {simulated
          ? "Try connecting an external assistant. This preview simulates a token valid for one hour. The example URL and token cannot connect to a real MCP server."
          : "Connect your agent to sample Blogs. No AI key needed. Temporary access lasts one hour."}
      </p>
      <div className="space-y-2">
        <label htmlFor={`${id}-url`} className="font-medium">
          MCP URL
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-url`}
            readOnly
            value={resource}
            className={cn(accountInputClass, "min-w-0")}
          />
          <IconTooltip label="Copy MCP URL">
            <button
              type="button"
              aria-label="Copy MCP URL"
              className={accountButtonClass}
              onClick={() => void copy(resource)}
            >
              <CopyIcon className="size-4" aria-hidden="true" />
            </button>
          </IconTooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          {simulated
            ? "Example connection · No data is shared"
            : "Streamable HTTP · Bearer token · This Mac only"}
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
              type={visible ? "text" : "password"}
              autoComplete="off"
              value={secret}
              className={cn(accountInputClass, "min-w-0")}
            />
            <IconTooltip label={visible ? "Hide temporary key" : "Show temporary key"}>
              <button
                type="button"
                className={accountButtonClass}
                aria-label={visible ? "Hide temporary key" : "Show temporary key"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? (
                  <EyeOffIcon className="size-4" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-4" aria-hidden="true" />
                )}
              </button>
            </IconTooltip>
            <IconTooltip label="Copy temporary key">
              <button
                type="button"
                aria-label="Copy temporary key"
                className={accountButtonClass}
                onClick={() => void copy(secret)}
              >
                <CopyIcon className="size-4" aria-hidden="true" />
              </button>
            </IconTooltip>
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
          {state?.expiresAt ? "Replace key" : "Create temporary key"}
        </button>
        {state?.expiresAt && (
          <button
            type="button"
            className={cn(accountButtonClass, destructiveActionClass)}
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
          {!simulated && <code className="block text-xs">pnpm demo:mcp</code>}
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
    </section>
  );
}
