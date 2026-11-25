"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import {
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  PanelLeftIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  SettingsIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { ImageCropDialog, type ImageCropLabels } from "@/components/image-crop";
import { Link } from "@/components/link";
import { useLoadingActivity } from "@/components/loading-indicator";
import { NativeSelect } from "@/components/native-select";
import { agentsLabels, type AgentsLabels } from "@/components/plugins/agents/labels";
import type {
  AgentAction,
  AgentAttachment,
  AgentConversation,
  AgentConversationSummary,
  AgentOperation,
  AgentModelOption,
  AgentModelProvider,
  AgentModelSettings,
  AgentsClient,
  AgentsSettingsClient,
} from "@/components/plugins/agents/types";
import { safeAgentResultHref } from "@/components/plugins/agents/types";
import { cn } from "@/components/utils/cn";
import { submitFormOnShortcut } from "@/components/utils/dialog-submit";
import { pluginIcons } from "@/components/utils/plugin-icons";

export type * from "@/components/plugins/agents/types";
export { AgentsError } from "@/components/plugins/agents/types";
export { agentsLabels, type AgentsLabels } from "@/components/plugins/agents/labels";

const button =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const outline = `${button} border border-border bg-background hover:bg-accent disabled:hover:bg-background`;
const primary = `${button} bg-primary text-primary-foreground hover:opacity-90`;
const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const bubble =
  "min-w-0 max-w-[min(90%,65ch)] rounded-xl rounded-tl-sm border border-border bg-card px-4 py-3 text-card-foreground";

export interface AgentsPageProps {
  client: AgentsClient;
  /** Reload after an external action while retaining unsent drafts. */
  refreshVersion?: number;
  /** Supply only for website administrators; the host must also authorize server requests. */
  settings?: AgentsSettingsClient;
  /** Optional host-owned assistant connection controls; the host authorizes their transport. */
  connectionSettings?: React.ReactNode;
  operationId: string | null;
  conversationId: string | null;
  onSelectionChange: (selection: {
    operationId: string | null;
    conversationId: string | null;
  }) => void;
  labels?: Partial<AgentsLabels>;
  cropLabels?: Partial<ImageCropLabels>;
  className?: string;
}
export function AgentsPage(props: AgentsPageProps) {
  const [identity, setIdentity] = useState({
    client: props.client,
    settings: props.settings,
    version: 0,
  });
  const [drafts, setDrafts] = useState<AgentDrafts>({});
  const [operations, setOperations] = useState<AgentOperation[]>([]);
  const [history, setHistory] = useState<AgentConversationSummary[]>([]);
  if (identity.client !== props.client || identity.settings !== props.settings) {
    setIdentity({ client: props.client, settings: props.settings, version: identity.version + 1 });
    setDrafts({});
    setOperations([]);
    setHistory([]);
  }
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <AgentsContent
        key={`${identity.version}:${props.operationId}:${props.conversationId}`}
        {...props}
        drafts={drafts}
        setDrafts={setDrafts}
        operations={operations}
        setOperations={setOperations}
        history={history}
        setHistory={setHistory}
      />
    </ActionToastProvider>
  );
}
type AgentDrafts = Record<
  string,
  { text: string; attachments: AgentAttachment[]; requestId?: string; queued?: "send" | File }
>;
function OperationIcon({ id }: { id: string }) {
  const Icon = Object.hasOwn(pluginIcons, id)
    ? pluginIcons[id as keyof typeof pluginIcons]
    : pluginIcons.agents;
  return <Icon className="size-4 shrink-0" aria-hidden="true" />;
}
async function listHistory(client: AgentsClient, operations: AgentOperation[]) {
  return (await Promise.all(operations.map((operation) => client.list(operation.id))))
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
}
function failure(error: unknown, labels: AgentsLabels) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (["FORBIDDEN", "NOT_FOUND"].includes(String(code))) return labels.unavailable;
  if (code === "BUSY") return labels.busy;
  if (code === "PENDING") return labels.pendingError;
  if (code === "UNRESOLVED") return labels.unresolved;
  if (code === "LIMIT") return labels.limit;
  if (code === "INVALID") return labels.invalid;
  if (code === "STORAGE") return labels.storage;
  if (code === "NOT_CONFIGURED") return labels.modelNotConfigured;
  return labels.error;
}

function ModelSettings({
  client,
  labels,
  connectionSettings,
}: {
  client: AgentsSettingsClient;
  labels: AgentsLabels;
  connectionSettings?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!busy) setOpen(open);
      }}
    >
      <Dialog.Trigger className={outline}>
        <SettingsIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.settings}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-dark/50" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-border bg-popover p-6 text-popover-foreground">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">
              {connectionSettings ? labels.settings : labels.modelSettings}
            </Dialog.Title>
            <IconTooltip label={labels.close}>
              <Dialog.Close aria-label={labels.close} disabled={busy} className={button}>
                <XIcon aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          {connectionSettings ? (
            <Tabs.Root defaultValue="connection" className="space-y-5">
              <Tabs.List aria-label={labels.settings} className="flex gap-4 border-b border-border">
                <Tabs.Tab
                  value="connection"
                  disabled={busy}
                  className="min-h-10 cursor-pointer border-b-2 border-transparent px-1 text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring data-active:border-primary data-active:text-foreground"
                >
                  {labels.externalAssistant}
                </Tabs.Tab>
                <Tabs.Tab
                  value="model"
                  className="min-h-10 cursor-pointer border-b-2 border-transparent px-1 text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring data-active:border-primary data-active:text-foreground"
                >
                  {labels.modelSettings}
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="connection">{connectionSettings}</Tabs.Panel>
              <Tabs.Panel value="model">
                <p className="mb-6 text-sm text-muted-foreground">{labels.settingsDescription}</p>
                {open && <ModelSettingsForm client={client} labels={labels} setBusy={setBusy} />}
              </Tabs.Panel>
            </Tabs.Root>
          ) : (
            <>
              <Dialog.Description className="mb-6 text-sm leading-6 text-muted-foreground">
                {labels.settingsDescription}
              </Dialog.Description>
              {open && <ModelSettingsForm client={client} labels={labels} setBusy={setBusy} />}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModelSettingsForm({
  client,
  labels,
  setBusy,
}: {
  client: AgentsSettingsClient;
  labels: AgentsLabels;
  setBusy: (busy: boolean) => void;
}) {
  const id = `factory-agent-settings-${useId()}`;
  const [saved, setSaved] = useState<AgentModelSettings | null>(null);
  const [provider, setProvider] = useState<AgentModelProvider>("openai");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<AgentModelOption[]>([]);
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const notify = useActionToast();
  useLoadingActivity(loading || pending);
  const [disconnecting, setDisconnecting] = useState(false);
  const active = useRef(true);
  const locked = useRef(false);
  const keepToken = saved?.provider === provider;
  useEffect(() => {
    active.current = true;
    let disposed = false;
    void client
      .get()
      .then((value) => {
        if (disposed) return;
        setSaved(value);
        if (value) {
          setProvider(value.provider);
          setModel(value.model);
          setModels([{ id: value.model, label: value.model }]);
        }
      })
      .catch(() => {
        if (!disposed) setError(labels.settingsLoadError);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      active.current = false;
      setBusy(false);
    };
  }, [client, labels.settingsLoadError, setBusy]);
  async function run(action: () => Promise<() => void>) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setBusy(true);
    setError("");
    try {
      const update = await action();
      if (active.current) update();
    } catch {
      if (active.current) setError(labels.settingsError);
    } finally {
      locked.current = false;
      if (active.current) {
        setPending(false);
        setBusy(false);
      }
    }
  }
  const credentials = { provider, ...(token.trim() ? { token: token.trim() } : {}) };
  return (
    <form
      onKeyDownCapture={submitFormOnShortcut}
      method="post"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await client.save({ ...credentials, model });
          return () => {
            setSaved({ provider, model });
            setToken("");
            setVisible(false);
            notify(labels.settingsSaved);
          };
        });
      }}
    >
      <fieldset disabled={loading || pending} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor={`${id}-provider`} className="text-sm font-medium">
            {labels.provider}
          </label>
          <NativeSelect
            id={`${id}-provider`}
            value={provider}
            className={field}
            onChange={(event) => {
              setProvider(event.target.value as AgentModelProvider);
              setToken("");
              setVisible(false);
              setModel("");
              setModels([]);
              setError("");
              setDisconnecting(false);
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="deepseek">DeepSeek</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-token`} className="text-sm font-medium">
            {labels.apiKey}
          </label>
          <div className="relative">
            <input
              id={`${id}-token`}
              name="token"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              spellCheck={false}
              maxLength={4096}
              required={!keepToken}
              className={cn(field, "pe-12")}
              value={token}
              aria-describedby={`${id}-key-help`}
              onChange={(event) => {
                setToken(event.target.value);
                setModels([]);
                setModel("");
                setError("");
              }}
            />
            <IconTooltip label={visible ? labels.hideKey : labels.showKey}>
              <button
                type="button"
                className={cn(button, "absolute inset-y-0 end-0")}
                aria-label={visible ? labels.hideKey : labels.showKey}
                aria-pressed={visible}
                aria-controls={`${id}-token`}
                onClick={() => setVisible(!visible)}
              >
                {visible ? (
                  <EyeOffIcon className="size-4" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-4" aria-hidden="true" />
                )}
              </button>
            </IconTooltip>
          </div>
          <p id={`${id}-key-help`} className="min-h-10 text-xs leading-5 text-muted-foreground">
            {keepToken ? labels.savedKey : labels.keyHelp}
          </p>
        </div>
        <button
          type="button"
          className={outline}
          disabled={!token.trim() && !keepToken}
          onClick={() =>
            void run(async () => {
              const choices = await client.models(credentials);
              return () => {
                setModels(choices);
                setModel(choices.some((choice) => choice.id === model) ? model : "");
                if (!choices.length) setError(labels.noModels);
              };
            })
          }
        >
          {labels.loadModels}
        </button>
        <div className="space-y-1">
          <label htmlFor={`${id}-model`} className="text-sm font-medium">
            {labels.model}
          </label>
          <NativeSelect
            id={`${id}-model`}
            className={field}
            value={model}
            required
            disabled={!models.length}
            onChange={(event) => {
              setModel(event.target.value);
            }}
          >
            <option value="">{labels.chooseModel}</option>
            {models.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </NativeSelect>
          <div className="min-h-20 pt-1">
            {error ? (
              <p role="alert" className="text-sm leading-5 text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">{labels.modelHelp}</p>
            )}
          </div>
        </div>
        {disconnecting && <p className="text-sm">{labels.disconnectDescription}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {saved && (
            <button
              type="button"
              className={outline}
              onClick={() => {
                if (!disconnecting) {
                  setDisconnecting(true);
                  return;
                }
                void run(async () => {
                  await client.remove();
                  return () => {
                    setSaved(null);
                    setToken("");
                    setVisible(false);
                    setModels([]);
                    setModel("");
                    setDisconnecting(false);
                    notify(labels.disconnected);
                  };
                });
              }}
            >
              {disconnecting ? labels.confirmDisconnect : labels.disconnect}
            </button>
          )}
          {disconnecting ? (
            <button type="button" className={outline} onClick={() => setDisconnecting(false)}>
              {labels.cancel}
            </button>
          ) : (
            <button
              type="submit"
              className={primary}
              disabled={!model || (!token.trim() && !keepToken)}
            >
              {labels.save}
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
function AttachmentView({
  client,
  conversationId,
  attachment,
  labels,
}: {
  client: AgentsClient;
  conversationId: string;
  attachment: AgentAttachment;
  labels: AgentsLabels;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let objectURL: string | null = null;
    client
      .attachment(conversationId, attachment.id)
      .then((blob) => {
        if (disposed) return;
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [client, conversationId, attachment.id]);
  return (
    <div className="max-w-56 space-y-1 break-words">
      {url && /^image\/(jpeg|png|webp)$/.test(attachment.contentType) && (
        <img
          src={url}
          alt={attachment.name}
          className="max-h-40 max-w-full rounded-md object-contain"
        />
      )}
      {url ? (
        <a
          href={url}
          download={attachment.name}
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {attachment.name}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">
          {failed ? labels.fileUnavailable : attachment.name}
        </span>
      )}
    </div>
  );
}
export function AgentActionReview({
  action,
  disabled,
  decide,
  labels,
  children,
  renderAttachment,
}: {
  action: AgentAction;
  disabled: boolean;
  decide: (approve: boolean) => void;
  labels: AgentsLabels;
  children?: React.ReactNode;
  renderAttachment?: (file: AgentAttachment) => React.ReactNode;
}) {
  const resultHref =
    action.status === "succeeded" ? safeAgentResultHref(action.resultHref) : undefined;
  return (
    <section
      aria-label={action.preview.title}
      className="my-4 space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold break-words">{action.preview.title}</h3>
          <p className="text-sm break-words text-muted-foreground">{action.preview.target}</p>
        </div>
        <output
          className={cn(
            "max-w-prose text-sm",
            action.status === "unresolved" || action.status === "stale"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {labels[action.status]}
        </output>
      </div>
      <dl className="space-y-3">
        {action.preview.changes.map((change, index) => (
          <div key={index} className="min-w-0">
            <dt className="text-sm font-medium break-words">{change.label}</dt>
            <dd className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
              {change.before !== undefined && (
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground">{labels.before}</span>
                  <p className="break-words whitespace-pre-wrap">{change.before}</p>
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">{labels.after}</span>
                <p className="break-words whitespace-pre-wrap">{change.after}</p>
              </div>
            </dd>
          </div>
        ))}
      </dl>
      {!!action.preview.attachments?.length && (
        <ul aria-label={labels.attachments} className="space-y-2 text-sm">
          {action.preview.attachments.map((file) => (
            <li key={file.id} className="break-words">
              {renderAttachment ? renderAttachment(file) : <span>{file.name}</span>}
              <p className="text-xs text-muted-foreground">
                {new Intl.NumberFormat(undefined, { style: "unit", unit: "byte" }).format(
                  file.size,
                )}
                {" · "}
                {file.contentType}
              </p>
            </li>
          ))}
        </ul>
      )}
      {children}
      {!!action.preview.effects.length && (
        <div>
          <h4 className="text-sm font-medium">{labels.effects}</h4>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {action.preview.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      )}
      {action.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primary}
            disabled={disabled}
            onClick={() => decide(true)}
          >
            {labels.approve}
          </button>
          <button
            type="button"
            className={outline}
            disabled={disabled}
            onClick={() => decide(false)}
          >
            {labels.reject}
          </button>
        </div>
      )}
      {(action.result || resultHref) && (
        <div className="flex items-start gap-2">
          {action.result && (
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-ring">
                {labels.result}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">
                {action.result}
              </pre>
            </details>
          )}
          {resultHref && (
            <IconTooltip label={labels.openRecord}>
              <Link href={resultHref} className={outline} aria-label={labels.openRecord}>
                <LinkIcon className="size-4" aria-hidden="true" />
              </Link>
            </IconTooltip>
          )}
        </div>
      )}
    </section>
  );
}
function AgentsContent({
  client,
  refreshVersion,
  settings,
  connectionSettings,
  operationId,
  conversationId,
  onSelectionChange,
  labels: overrides,
  cropLabels,
  className,
  drafts,
  setDrafts,
  operations,
  setOperations,
  history,
  setHistory,
}: AgentsPageProps & {
  drafts: AgentDrafts;
  setDrafts: Dispatch<SetStateAction<AgentDrafts>>;
  operations: AgentOperation[];
  setOperations: Dispatch<SetStateAction<AgentOperation[]>>;
  history: AgentConversationSummary[];
  setHistory: Dispatch<SetStateAction<AgentConversationSummary[]>>;
}) {
  const labels = { ...agentsLabels, ...overrides };
  const notify = useActionToast();
  const uid = `factory-agents-${useId()}`;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState<unknown>(null);
  const errorText = error || (loadError ? failure(loadError, labels) : "");
  const [streaming, setStreaming] = useState(false);
  const [stream, setStream] = useState("");
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [crop, setCrop] = useState<File | null>(null);
  const [attachmentOption, setAttachmentOption] = useState("0");
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const key = conversationId ?? operationId ?? "";
  const draft: AgentDrafts[string] = drafts[key] ?? { text: "", attachments: [] };
  const operation = operations.find((operation) => operation.id === operationId);
  const started = !!conversation?.messages.length;
  const blocked = busy || loading || !!conversation?.running;
  const waiting = conversation?.actions.some(
    (action) => action.status === "pending" || action.status === "unresolved",
  );
  const imageCrop = operation?.attachmentOptions?.[Number(attachmentOption)]?.crop;
  const updateDraft = (value: Partial<typeof draft>) =>
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { text: "", attachments: [] }), requestId: undefined, ...value },
    }));
  useLoadingActivity(loading);
  useEffect(() => {
    const request = ++generation.current;
    const availableOperations = client.operations();
    Promise.all([
      availableOperations,
      availableOperations.then((operations) => listHistory(client, operations)),
      conversationId ? client.get(conversationId) : Promise.resolve(null),
    ])
      .then(([ops, chats, chat]) => {
        if (request !== generation.current) return;
        setOperations(ops);
        setHistory(chats);
        if (
          (operationId && !ops.some((operation) => operation.id === operationId)) ||
          (chat && chat.operationId !== operationId)
        ) {
          setLoadError({ code: "NOT_FOUND" });
          return;
        }
        setConversation(chat);
      })
      .catch((error) => {
        if (request === generation.current) setLoadError(error);
      })
      .finally(() => {
        if (request === generation.current) setLoading(false);
      });
    const abort = () => controller.current?.abort();
    return () => {
      generation.current = request + 1;
      abort();
    };
  }, [client, operationId, conversationId, revision, refreshVersion, setOperations, setHistory]);
  useEffect(() => {
    const element = transcript.current;
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 160)
      element.scrollTop = element.scrollHeight;
  }, [stream, conversation?.messages.length]);
  const current = (request: number) => request === generation.current;
  async function refreshChat(request: number) {
    if (!conversationId) return;
    const [chat, chats] = await Promise.all([
      client.get(conversationId),
      listHistory(client, operations),
    ]);
    if (current(request)) {
      setConversation(chat);
      setHistory(chats);
    }
  }
  async function run(action: (request: number) => Promise<void>) {
    if (pending.current) return;
    const request = generation.current;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action(request);
    } catch (error) {
      if (current(request)) setError(failure(error, labels));
    } finally {
      if (current(request)) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  async function createConversation(request: number, queued: "send" | File) {
    if (!operation) return;
    const chat = await client.create(operation.id);
    if (!current(request)) return;
    setDrafts((drafts) => {
      const next = {
        ...drafts,
        [chat.id]: { ...(drafts[key] ?? { text: "", attachments: [] }), queued },
      };
      if (key !== chat.id) delete next[key];
      return next;
    });
    onSelectionChange({ operationId, conversationId: chat.id });
  }
  async function send(resume = false) {
    if (blocked || waiting || (!resume && !draft.text.trim() && !draft.attachments.length)) return;
    if (!conversationId) {
      if (operation && !resume) await run((request) => createConversation(request, "send"));
      return;
    }
    await run(async (request) => {
      const abort = new AbortController();
      controller.current = abort;
      setStreaming(true);
      setStream("");
      const submitted = { ...draft, attachments: [...draft.attachments] };
      const requestId = (!resume && submitted.requestId) || crypto.randomUUID();
      if (!resume) updateDraft({ requestId, queued: undefined });
      try {
        for await (const event of client.send(
          {
            conversationId,
            requestId,
            text: resume ? "" : submitted.text,
            attachmentIds: resume ? [] : submitted.attachments.map((file) => file.id),
            resume,
          },
          abort.signal,
        )) {
          if (!current(request)) return;
          if (event.type === "text") setStream((text) => text + event.text);
          else {
            setConversation(event.conversation);
            if (!resume) updateDraft({ text: "", attachments: [] });
          }
        }
      } finally {
        if (current(request)) {
          await refreshChat(request);
          setStream("");
          setStreaming(false);
        }
      }
    });
  }
  async function upload(file: File, propagate = false) {
    if (!conversationId && !operation) return;
    let uploadError: unknown;
    await run(async (request) => {
      try {
        if (!conversationId) {
          await createConversation(request, file);
          return;
        }
        updateDraft({ queued: undefined, requestId: draft.requestId });
        const attachment = await client.attach(conversationId, file);
        if (current(request)) {
          updateDraft({ attachments: [...draft.attachments, attachment] });
          setFailedFile(null);
          setCrop(null);
        }
      } catch (error) {
        uploadError = error;
        if (current(request)) setFailedFile(file);
        throw error;
      }
    });
    if (propagate && uploadError) throw uploadError;
  }
  // URL selection remounts the chat; consume the submitted draft after it loads.
  useEffect(() => {
    if (loading || !conversation || !draft.queued) return;
    let disposed = false;
    void Promise.resolve().then(() => {
      if (disposed) return;
      if (draft.queued === "send") void send();
      else if (draft.queued) void upload(draft.queued);
    });
    return () => {
      disposed = true;
    };
  });
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const historyGroup = (updatedAt: string) => {
    const date = new Date(updatedAt);
    return date >= today ? labels.today : date >= yesterday ? labels.yesterday : labels.earlier;
  };
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
      aria-label={labels.title}
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border pb-4 [@media(max-height:600px)]:pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{labels.title}</h1>
            {settings && (
              <ModelSettings
                client={settings}
                labels={labels}
                connectionSettings={connectionSettings}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground [@media(max-height:600px)]:hidden">
            {labels.privateConversations}
          </p>
        </div>
        <button
          type="button"
          className={cn(historyOpen ? primary : outline, "md:hidden")}
          aria-expanded={historyOpen}
          aria-controls={`${uid}-history`}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <PanelLeftIcon aria-hidden="true" className="size-4 shrink-0" />
          {labels.conversations}
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          id={`${uid}-history`}
          aria-label={labels.conversations}
          className={cn(
            "min-h-0 min-w-0 flex-col gap-3 border-b border-border bg-muted/40 p-3 md:flex md:border-e md:border-b-0",
            historyOpen ? "flex" : "hidden",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{labels.conversations}</h2>
            <IconTooltip label={labels.refresh}>
              <button
                type="button"
                className={button}
                aria-label={labels.refresh}
                disabled={busy || loading}
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setError("");
                  setRevision((value) => value + 1);
                }}
              >
                <RefreshCwIcon aria-hidden="true" className="size-4" />
              </button>
            </IconTooltip>
          </div>
          <button
            type="button"
            className={cn(outline, "w-full shrink-0")}
            aria-label={
              overrides?.newConversation ?? overrides?.conversation ?? agentsLabels.newConversation
            }
            disabled={!conversationId || blocked}
            onClick={() => {
              setError("");
              setFailedFile(null);
              setCrop(null);
              onSelectionChange({ operationId, conversationId: null });
            }}
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {overrides?.newConversation ?? overrides?.conversation ?? agentsLabels.newConversation}
          </button>
          {!history.length && !loading && (
            <p className="text-sm text-muted-foreground">{labels.emptyHistory}</p>
          )}
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto overscroll-contain">
            {history.map((chat, index) => (
              <li key={chat.id} className="min-w-0">
                {(index === 0 ||
                  historyGroup(chat.updatedAt) !== historyGroup(history[index - 1]!.updatedAt)) && (
                  <h3 className="mt-5 mb-2 px-3 text-xs font-medium text-muted-foreground">
                    {historyGroup(chat.updatedAt)}
                  </h3>
                )}
                <IconTooltip label={chat.title || labels.untitled}>
                  <button
                    type="button"
                    aria-label={chat.title || labels.untitled}
                    aria-describedby={`${uid}-history-${chat.id}`}
                    aria-current={chat.id === conversationId ? "page" : undefined}
                    className={cn(
                      button,
                      "w-full min-w-0 items-start justify-start text-start",
                      chat.id === conversationId
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() => {
                      setHistoryOpen(false);
                      onSelectionChange({ operationId: chat.operationId, conversationId: chat.id });
                    }}
                  >
                    <span className="mt-0.5">
                      <OperationIcon id={chat.operationId} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{chat.title || labels.untitled}</span>
                      <span
                        id={`${uid}-history-${chat.id}`}
                        className="mt-1 block text-xs text-muted-foreground"
                      >
                        {operations.find((operation) => operation.id === chat.operationId)?.label}
                      </span>
                    </span>
                  </button>
                </IconTooltip>
              </li>
            ))}
          </ul>
        </nav>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-col bg-muted/15 px-3 md:flex md:px-6",
            historyOpen ? "hidden" : "flex",
          )}
        >
          {errorText && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center gap-2 text-sm text-destructive"
            >
              <p>{errorText}</p>
              <button
                type="button"
                className={outline}
                disabled={busy}
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setError("");
                  setRevision((value) => value + 1);
                }}
              >
                {labels.refresh}
              </button>
            </div>
          )}
          <div
            ref={transcript}
            role="log"
            aria-label={labels.message}
            aria-live="polite"
            aria-relevant="additions"
            className={cn(
              "min-h-0 flex-1 space-y-6 overflow-auto overscroll-contain py-6 [overflow-wrap:anywhere] [@media(max-height:600px)]:py-2",
              started && "mx-auto w-full max-w-5xl",
            )}
          >
            {loading ? (
              <output className="block text-sm text-muted-foreground">{labels.loading}</output>
            ) : !started ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">{labels.emptyChat}</h2>
                <p className="text-sm text-muted-foreground">
                  {operations.length ? labels.chooseFirst : labels.noOperations}
                </p>
                {!!operations.length && (
                  <ul
                    aria-label={labels.operation}
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                  >
                    {operations.map((op, index) => (
                      <li key={op.id} className="min-w-0">
                        <button
                          type="button"
                          aria-labelledby={`${uid}-operation-${index}-title`}
                          aria-describedby={`${uid}-operation-${index}-description`}
                          className={cn(
                            "flex h-full w-full cursor-pointer flex-col gap-2 rounded-xl border p-4 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
                            op.id === operationId
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted",
                          )}
                          aria-pressed={op.id === operationId}
                          disabled={blocked}
                          onClick={() => {
                            if (op.id !== operationId)
                              onSelectionChange({ operationId: op.id, conversationId: null });
                          }}
                        >
                          <span
                            id={`${uid}-operation-${index}-title`}
                            className="flex items-center gap-2 font-semibold"
                          >
                            <OperationIcon id={op.id} />
                            {op.label}
                          </span>
                          <span
                            id={`${uid}-operation-${index}-description`}
                            className="text-sm leading-6 text-muted-foreground"
                          >
                            {op.description}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {conversation?.messages.map((entry) => (
              <Fragment key={entry.id}>
                <article
                  data-role={entry.role}
                  className={cn(
                    "flex min-w-0 flex-col gap-2",
                    entry.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <h2 className="text-xs font-medium text-muted-foreground">
                    {entry.role === "user"
                      ? labels.you
                      : entry.role === "assistant"
                        ? labels.assistant
                        : labels.tool}
                  </h2>
                  <div
                    className={cn(
                      bubble,
                      entry.role === "user" &&
                        "rounded-tl-xl rounded-tr-sm border-transparent bg-primary/15 text-foreground",
                    )}
                  >
                    {entry.role === "tool" ? (
                      <details>
                        <summary className="cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-ring">
                          {labels.result}
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto text-xs break-all whitespace-pre-wrap">
                          {entry.text}
                        </pre>
                      </details>
                    ) : (
                      <p className="text-sm leading-7 whitespace-pre-wrap">{entry.text}</p>
                    )}
                    {!!entry.attachments.length && (
                      <div className="mt-3 flex flex-wrap gap-4">
                        {entry.attachments.map((file) => (
                          <AttachmentView
                            key={file.id}
                            client={client}
                            conversationId={conversation.id}
                            attachment={file}
                            labels={labels}
                          />
                        ))}
                      </div>
                    )}
                    {entry.download && client.download && (
                      <button
                        type="button"
                        className={outline}
                        onClick={() =>
                          void run(async () => {
                            const file = await client.download!(conversation.id, entry.id);
                            const link = document.createElement("a");
                            link.href = file.url;
                            link.download = file.name;
                            link.rel = "noreferrer";
                            link.click();
                          })
                        }
                      >
                        <DownloadIcon aria-hidden="true" className="size-4" />
                        {labels.download}
                      </button>
                    )}
                  </div>
                </article>
                {conversation.actions
                  .filter((action) => action.messageId === entry.id)
                  .map((action) => (
                    <AgentActionReview
                      key={action.id}
                      action={action}
                      labels={labels}
                      disabled={blocked}
                      renderAttachment={(file) => (
                        <AttachmentView
                          client={client}
                          conversationId={conversation.id}
                          attachment={file}
                          labels={labels}
                        />
                      )}
                      decide={(approve) =>
                        void run(async (request) => {
                          const chat = await client.decide({
                            conversationId: conversation.id,
                            actionId: action.id,
                            approve,
                          });
                          if (current(request)) {
                            setConversation(chat);
                            if (
                              chat.actions.find((item) => item.id === action.id)?.status ===
                              "succeeded"
                            )
                              notify(labels.updated);
                          }
                        })
                      }
                    >
                      {!action.preview.attachments &&
                        action.preview.attachmentIds?.map((id) => {
                          const file = conversation.messages
                            .flatMap((message) => message.attachments)
                            .find((file) => file.id === id);
                          return file ? (
                            <AttachmentView
                              key={id}
                              client={client}
                              conversationId={conversation.id}
                              attachment={file}
                              labels={labels}
                            />
                          ) : null;
                        })}
                    </AgentActionReview>
                  ))}
              </Fragment>
            ))}
            {stream && (
              <article data-role="assistant" className="flex min-w-0 flex-col items-start gap-2">
                <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
                  {labels.assistant}
                </h2>
                <div className={bubble}>
                  <p className="text-sm leading-7 whitespace-pre-wrap">{stream}</p>
                </div>
              </article>
            )}
            {busy && (
              <output className="block text-sm text-muted-foreground">{labels.thinking}</output>
            )}
          </div>
          <form
            onKeyDownCapture={submitFormOnShortcut}
            className="mx-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] w-full max-w-5xl shrink-0 space-y-3 rounded-xl border border-border bg-background p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring md:p-4 [@media(max-height:600px)]:space-y-2 [@media(max-height:600px)]:p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label htmlFor={`${uid}-message`} className="sr-only">
              {labels.message}
            </label>
            <textarea
              id={`${uid}-message`}
              rows={2}
              maxLength={32000}
              className={cn(
                field,
                "max-h-[min(12rem,25dvh)] resize-y border-0 bg-transparent px-1 leading-6 focus-visible:outline-none [@media(max-height:600px)]:h-10",
              )}
              placeholder={labels.placeholder}
              disabled={!operation || blocked || waiting}
              value={draft.text}
              onChange={(event) => updateDraft({ text: event.target.value })}
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.altKey ||
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229 ||
                  event.defaultPrevented
                )
                  return;
                event.preventDefault();
                if (
                  !event.repeat &&
                  !blocked &&
                  !waiting &&
                  (draft.text.trim() || draft.attachments.length)
                )
                  event.currentTarget.form?.requestSubmit();
              }}
            />
            {!!draft.attachments.length && (
              <ul aria-label={labels.attachments} className="flex flex-wrap gap-2">
                {draft.attachments.map((file) => (
                  <li
                    key={file.id}
                    className="flex min-w-0 items-center gap-1 rounded-md border border-border px-2"
                  >
                    <span className="text-sm break-all">{file.name}</span>
                    <IconTooltip label={labels.removeAttachment}>
                      <button
                        type="button"
                        aria-label={`${labels.removeAttachment}: ${file.name}`}
                        className={button}
                        disabled={blocked}
                        onClick={() =>
                          updateDraft({
                            attachments: draft.attachments.filter((item) => item.id !== file.id),
                          })
                        }
                      >
                        <XIcon aria-hidden="true" className="size-4" />
                      </button>
                    </IconTooltip>
                  </li>
                ))}
              </ul>
            )}
            {failedFile && (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-2 text-sm text-destructive"
              >
                <span>
                  {labels.attachmentFailed} {failedFile.name}
                </span>
                <button
                  type="button"
                  className={outline}
                  disabled={busy}
                  onClick={() => void upload(failedFile)}
                >
                  {labels.retry}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex max-w-full flex-wrap items-center gap-2">
                <IconTooltip label={labels.attach}>
                  <button
                    type="button"
                    className={outline}
                    aria-label={labels.attach}
                    disabled={!operation || blocked || !!waiting || draft.attachments.length >= 10}
                    onClick={() => picker.current?.click()}
                  >
                    <PaperclipIcon aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">{labels.attach}</span>
                  </button>
                </IconTooltip>
                <input
                  ref={picker}
                  type="file"
                  className="hidden"
                  aria-label={labels.attach}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (file.type.startsWith("image/") && imageCrop) setCrop(file);
                    else void upload(file);
                  }}
                />
                {operation?.attachmentOptions && operation.attachmentOptions.length > 1 && (
                  <div className="max-w-48">
                    <NativeSelect
                      aria-label={labels.imageUse}
                      value={attachmentOption}
                      className={field}
                      disabled={blocked}
                      onChange={(event) => setAttachmentOption(event.target.value)}
                    >
                      {operation.attachmentOptions.map((option, index) => (
                        <option key={index} value={String(index)}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                {conversation && (
                  <IconTooltip label={labels.deleteConversation}>
                    <button
                      type="button"
                      className={button}
                      aria-label={labels.deleteConversation}
                      disabled={blocked}
                      onClick={() => {
                        setError("");
                        setLoadError(null);
                        setDeleting(true);
                      }}
                    >
                      <Trash2Icon aria-hidden="true" className="size-4" />
                    </button>
                  </IconTooltip>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {conversation?.canResume && !waiting && (
                  <button
                    type="button"
                    className={outline}
                    disabled={blocked}
                    onClick={() => void send(true)}
                  >
                    {error ? labels.retry : labels.resume}
                  </button>
                )}
                {streaming ? (
                  <button
                    type="button"
                    className={outline}
                    onClick={() => {
                      controller.current?.abort();
                      setStreaming(false);
                    }}
                  >
                    <SquareIcon aria-hidden="true" className="size-4" />
                    {labels.stop}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={primary}
                    disabled={
                      !operation ||
                      blocked ||
                      !!waiting ||
                      (!draft.text.trim() && !draft.attachments.length)
                    }
                  >
                    <SendHorizontalIcon aria-hidden="true" className="size-4" />
                    {labels.send}
                  </button>
                )}
              </div>
            </div>
            <p className="hidden text-center text-xs text-muted-foreground md:block">
              {labels.keyboardHelp}
            </p>
          </form>
        </div>
      </div>
      {crop && imageCrop && (
        <ImageCropDialog
          file={crop}
          {...imageCrop}
          labels={cropLabels}
          onCancel={() => setCrop(null)}
          onConfirm={(file) => upload(file, true)}
        />
      )}
      <Dialog.Root
        open={deleting}
        onOpenChange={(open) => {
          if (!busy) setDeleting(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-dark/50" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-lg font-semibold">{labels.deleteTitle}</Dialog.Title>
              <IconTooltip label={labels.close}>
                <Dialog.Close aria-label={labels.close} disabled={busy} className={button}>
                  <XIcon aria-hidden="true" className="size-4" />
                </Dialog.Close>
              </IconTooltip>
            </div>
            <Dialog.Description className="text-sm text-muted-foreground">
              {labels.deleteDescription}
            </Dialog.Description>
            {errorText && (
              <p role="alert" className="text-sm text-destructive">
                {errorText}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close disabled={busy} className={outline}>
                {labels.cancel}
              </Dialog.Close>
              <button
                type="button"
                className={cn(button, "bg-destructive text-destructive-foreground")}
                disabled={busy}
                onClick={() =>
                  void run(async (request) => {
                    await client.remove(conversationId!);
                    if (current(request)) {
                      setDeleting(false);
                      onSelectionChange({ operationId, conversationId: null });
                    }
                  })
                }
              >
                {labels.confirmDelete}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
