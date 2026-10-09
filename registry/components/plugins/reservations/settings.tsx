"use client";

import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import type { ComponentType } from "react";

import { useActionToast, ActionToastProvider } from "@/components/action-toast";
import { Link, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import {
  getReservationLabels,
  type ReservationLabels,
} from "@/components/plugins/reservations/labels";
import {
  reservationPolicyDefaults,
  reservationStayPolicyDefaults,
} from "@/components/plugins/reservations/model";
import type {
  ReservationConfiguration,
  ReservationHours,
  ReservationMode,
  ReservationResource,
  ReservationService,
  ReservationSettings,
  ReservationsAdminClient,
} from "@/components/plugins/reservations/types";
import {
  buttonClass,
  primaryClass,
  fieldClass,
  pageClass,
  panelClass,
  Field,
  ErrorNotice,
  Modal,
  useReservationAction,
  useReservationLoad,
} from "@/components/plugins/reservations/ui";
import { cn } from "@/components/utils/cn";

export interface ReservationSettingsPageProps {
  client: ReservationsAdminClient;
  editor?: { kind: "service" | "resource"; id: string };
  getServiceHref: (id: string) => string;
  getResourceHref: (id: string) => string;
  backHref: string;
  onSaved?: (kind: "service" | "resource", id: string) => void;
  labels?: Partial<ReservationLabels>;
  className?: string;
  linkComponent?: ComponentType<LinkProps>;
}

function ReservationSettingsPageContent({
  client,
  editor,
  getServiceHref,
  getResourceHref,
  backHref,
  onSaved,
  labels: overrides,
  className,
  linkComponent: HostLink = Link,
}: ReservationSettingsPageProps) {
  const load = useCallback(() => client.configuration(), [client]);
  const data = useReservationLoad(load);
  const config = data.value;
  const labels = getReservationLabels(overrides, config?.mode);
  const item =
    editor?.kind === "service"
      ? config?.services.find((s) => s.id === editor.id)
      : config?.resources.find((r) => r.id === editor?.id);
  return (
    <section className={cn(pageClass, className)}>
      <HostLink
        className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
        href={backHref}
      >
        {labels.back}
      </HostLink>
      <h1 className="font-serif text-3xl font-semibold">
        {editor ? (editor.kind === "service" ? labels.service : labels.resource) : labels.settings}
      </h1>
      <ErrorNotice error={data.error} labels={labels} />
      {data.error ? (
        <button className={buttonClass} onClick={data.reload}>
          <RefreshCwIcon className="size-4 shrink-0" aria-hidden="true" />
          {labels.refresh}
        </button>
      ) : !config ? (
        <output className="block">{labels.loading}</output>
      ) : editor ? (
        editor.id !== "new" && !item ? (
          <p role="alert">{labels.invalid}</p>
        ) : editor.kind === "service" ? (
          <ServiceEditor
            key={editor.id}
            value={item as ReservationService | undefined}
            config={config}
            client={client}
            labels={labels}
            onSaved={(id) => onSaved?.("service", id)}
          />
        ) : (
          <ResourceEditor
            key={editor.id}
            mode={config.mode}
            value={item as ReservationResource | undefined}
            client={client}
            labels={labels}
            onSaved={(id) => onSaved?.("resource", id)}
          />
        )
      ) : (
        <>
          <BusinessSettings value={config.settings} client={client} labels={labels} />
          {(["service", "resource"] as const).map((kind) => (
            <div key={kind} className={cn(panelClass, "space-y-4")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {kind === "service" ? labels.services : labels.resources}
                </h2>
                <HostLink
                  className={buttonClass}
                  href={kind === "service" ? getServiceHref("new") : getResourceHref("new")}
                >
                  <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
                  {kind === "service" ? labels.newService : labels.newResource}
                </HostLink>
              </div>
              <ul className="divide-y divide-border">
                {(kind === "service" ? config.services : config.resources).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <span className="font-medium">{entry.name}</span>
                      {entry.archived && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {labels.archived}
                        </span>
                      )}
                    </div>
                    <HostLink
                      className={cn(buttonClass, "size-10 p-0")}
                      href={
                        kind === "service" ? getServiceHref(entry.id) : getResourceHref(entry.id)
                      }
                      aria-label={`${labels.edit} ${entry.name}`}
                    >
                      <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
                    </HostLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function BusinessSettings({
  value,
  client,
  labels,
}: {
  value: ReservationSettings;
  client: ReservationsAdminClient;
  labels: ReservationLabels;
}) {
  const [draft, setDraft] = useState(value);
  const notify = useActionToast();
  const action = useReservationAction();
  return (
    <form
      className={cn(panelClass, "space-y-4")}
      onSubmit={(e) => {
        e.preventDefault();

        void action.run(async () => {
          setDraft(await client.saveSettings(draft));
          notify(labels.saved);
        });
      }}
    >
      <h2 className="text-xl font-semibold">{labels.business}</h2>
      <ErrorNotice error={action.error} labels={labels} />
      <Field label={labels.timeZone}>
        <input
          className={fieldClass}
          required
          value={draft.timeZone}
          placeholder="Europe/Zurich"
          onChange={(e) => {
            setDraft({ ...draft, timeZone: e.target.value });
          }}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.publicBookingEnabled}
          onChange={(e) => {
            setDraft({ ...draft, publicBookingEnabled: e.target.checked });
          }}
        />
        {labels.publicEnabled}
      </label>
      <button className={primaryClass} disabled={action.busy}>
        {action.busy ? labels.saving : labels.save}
      </button>
    </form>
  );
}

const policyFields = [
  ["durationMinutes", "duration", 1, 1440],
  ["bufferBeforeMinutes", "bufferBefore", 0, 1440],
  ["bufferAfterMinutes", "bufferAfter", 0, 1440],
  ["cancellationMinutes", "cancellation", 0, 525600],
  ["noticeMinutes", "notice", 0, 525600],
  ["horizonDays", "horizon", 1, 365],
  ["intervalMinutes", "interval", 1, 1440],
] as const;

function ServiceEditor({
  value,
  config,
  client,
  labels,
  onSaved,
}: {
  value?: ReservationService;
  config: ReservationConfiguration;
  client: ReservationsAdminClient;
  labels: ReservationLabels;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ReservationService>(
    () =>
      value ?? {
        ...reservationPolicyDefaults,
        id: "",
        version: 0,
        name: "",
        description: "",
        ...(config.mode === "stay"
          ? { ...reservationStayPolicyDefaults, arrivalStart: "", arrivalEnd: "", checkoutTime: "" }
          : { durationMinutes: 0 }),
        active: false,
        archived: false,
        resourceIds: [],
      },
  );
  const notify = useActionToast();
  const [archiving, setArchiving] = useState(false);
  const action = useReservationAction();
  const save = async (archive = false) => {
    const input = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      archived: archive || draft.archived,
    };
    setDraft(input);

    const next = await client.saveService(input);
    setDraft(next);
    notify(labels.saved);
    setArchiving(false);
    onSaved(next.id);
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(() => save());
      }}
    >
      <ErrorNotice error={action.error} labels={labels} />
      <div className={cn(panelClass, "space-y-4")}>
        <Field label={labels.name}>
          <input
            className={fieldClass}
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value });
            }}
          />
        </Field>
        <Field label={labels.description}>
          <textarea
            className={fieldClass}
            maxLength={2000}
            value={draft.description}
            onChange={(e) => {
              setDraft({ ...draft, description: e.target.value });
            }}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.active}
            disabled={draft.archived}
            onChange={(e) => {
              setDraft({ ...draft, active: e.target.checked });
            }}
          />
          {labels.active}
        </label>
      </div>
      <fieldset className={cn(panelClass, "space-y-3")}>
        <legend className="px-2 font-medium">{labels.eligibleResources}</legend>
        {config.resources
          .filter((r) => !r.archived)
          .map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.resourceIds.includes(r.id)}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    resourceIds: e.target.checked
                      ? [...draft.resourceIds, r.id]
                      : draft.resourceIds.filter((id) => id !== r.id),
                  });
                }}
              />
              {r.name}
            </label>
          ))}
      </fieldset>
      <div className={cn(panelClass, "space-y-5")}>
        <p className="text-sm text-muted-foreground">{labels.policyHelp}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {policyFields
            .filter(([field]) => field !== "durationMinutes" || draft.mode !== "stay")
            .map(([field, label, min, max]) => (
              <Field key={field} label={labels[label]}>
                <input
                  className={fieldClass}
                  type="number"
                  required
                  min={min}
                  max={max}
                  step={1}
                  value={draft[field] || (field === "durationMinutes" ? "" : 0)}
                  onChange={(e) => {
                    setDraft({ ...draft, [field]: e.target.valueAsNumber });
                  }}
                />
              </Field>
            ))}
          {draft.mode === "stay" && (
            <>
              {(["arrivalStart", "arrivalEnd", "checkoutTime"] as const).map((field) => (
                <Field key={field} label={labels[field]}>
                  <input
                    type="time"
                    required
                    className={fieldClass}
                    value={draft[field]}
                    onChange={(e) => {
                      setDraft({ ...draft, [field]: e.target.value });
                    }}
                  />
                </Field>
              ))}
              {(["minNights", "maxNights"] as const).map((field) => (
                <Field key={field} label={labels[field]}>
                  <input
                    type="number"
                    required
                    min={1}
                    max={365}
                    step={1}
                    className={fieldClass}
                    value={draft[field]}
                    onChange={(e) => {
                      setDraft({ ...draft, [field]: e.target.valueAsNumber });
                    }}
                  />
                </Field>
              ))}
            </>
          )}
          <Field label={labels.approval}>
            <NativeSelect
              className={fieldClass}
              value={draft.approval}
              onChange={(e) => {
                setDraft({ ...draft, approval: e.target.value as "automatic" | "manual" });
              }}
            >
              <option value="automatic">{labels.automatic}</option>
              <option value="manual">{labels.manual}</option>
            </NativeSelect>
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className={primaryClass} disabled={action.busy}>
          {action.busy ? labels.saving : labels.save}
        </button>
        {draft.version > 0 && !draft.archived && (
          <ArchiveButton labels={labels} onClick={() => setArchiving(true)} />
        )}
        {draft.archived && <span>{labels.archived}</span>}
      </div>
      {archiving && (
        <ArchiveDialog
          labels={labels}
          action={action}
          onClose={() => setArchiving(false)}
          onArchive={() => save(true)}
        />
      )}
    </form>
  );
}

function HoursEditor({
  value,
  onChange,
  labels,
}: {
  value: ReservationHours[];
  onChange: (value: ReservationHours[]) => void;
  labels: ReservationLabels;
}) {
  return (
    <div className="space-y-3">
      {!value.length && <p className="text-sm text-muted-foreground">{labels.closed}</p>}
      {value.map((hours, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Field label={labels.start}>
            <input
              className={fieldClass}
              type="time"
              required
              value={hours.start}
              onChange={(e) =>
                onChange(value.map((h, j) => (j === i ? { ...h, start: e.target.value } : h)))
              }
            />
          </Field>
          <Field label={labels.end}>
            <input
              className={cn(fieldClass, "max-w-36")}
              type="text"
              inputMode="numeric"
              required
              pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00"
              value={hours.end}
              onChange={(e) =>
                onChange(value.map((h, j) => (j === i ? { ...h, end: e.target.value } : h)))
              }
            />
          </Field>
          <button
            type="button"
            className={cn(buttonClass, "size-10 p-0")}
            aria-label={`${labels.remove} ${hours.start}–${hours.end}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange([...value, { start: "09:00", end: "17:00" }])}
      >
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.addHours}
      </button>
    </div>
  );
}

function ResourceEditor({
  mode,
  value,
  client,
  labels,
  onSaved,
}: {
  mode: ReservationMode;
  value?: ReservationResource;
  client: ReservationsAdminClient;
  labels: ReservationLabels;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ReservationResource>(
    () =>
      value ?? {
        id: "",
        version: 0,
        name: "",
        active: false,
        archived: false,
        weeklyHours: {},
        exceptions: {},
        ...(mode === "stay" ? { blockedDates: [] } : {}),
      },
  );
  const [date, setDate] = useState("");
  const notify = useActionToast();
  const [archiving, setArchiving] = useState(false);
  const action = useReservationAction();
  const change = (value: ReservationResource) => {
    setDraft(value);
  };
  const save = async (archive = false) => {
    const input = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      archived: archive || draft.archived,
    };
    change(input);
    const next = await client.saveResource(input);
    setDraft(next);
    notify(labels.saved);
    setArchiving(false);
    onSaved(next.id);
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(() => save());
      }}
    >
      <ErrorNotice error={action.error} labels={labels} />
      <div className={cn(panelClass, "space-y-4")}>
        <Field label={labels.name}>
          <input
            className={fieldClass}
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => change({ ...draft, name: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.active}
            disabled={draft.archived}
            onChange={(e) => change({ ...draft, active: e.target.checked })}
          />
          {labels.active}
        </label>
      </div>
      {mode === "stay" ? (
        <div className={cn(panelClass, "space-y-4")}>
          <h2 className="text-xl font-semibold">{labels.blockedDates}</h2>
          <p className="text-sm text-muted-foreground">{labels.closuresHelp}</p>
          {(draft.blockedDates ?? []).map((block, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              {(["from", "through"] as const).map((field) => (
                <Field
                  key={field}
                  label={field === "from" ? labels.blockedFrom : labels.blockedThrough}
                >
                  <input
                    type="date"
                    required
                    className={fieldClass}
                    value={block[field]}
                    min={field === "through" ? block.from : undefined}
                    onChange={(e) =>
                      change({
                        ...draft,
                        blockedDates: draft.blockedDates!.map((old, i) =>
                          i === index ? { ...old, [field]: e.target.value } : old,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <button
                type="button"
                className={cn(buttonClass, "size-10 p-0")}
                aria-label={`${labels.remove} ${block.from}–${block.through}`}
                onClick={() =>
                  change({
                    ...draft,
                    blockedDates: draft.blockedDates!.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2Icon aria-hidden="true" className="size-4 shrink-0" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              change({
                ...draft,
                blockedDates: [...(draft.blockedDates ?? []), { from: "", through: "" }],
              })
            }
          >
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
            {labels.addClosure}
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold">{labels.hours}</h2>
          <p className="text-sm text-muted-foreground">{labels.hoursHelp}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 7 }, (_, i) => String(i + 1)).map((day) => (
              <fieldset className={panelClass} key={day}>
                <legend className="px-2 font-medium">
                  {labels[`weekday${day}` as keyof ReservationLabels]}
                </legend>
                <HoursEditor
                  value={draft.weeklyHours[day] ?? []}
                  onChange={(hours) =>
                    change({ ...draft, weeklyHours: { ...draft.weeklyHours, [day]: hours } })
                  }
                  labels={labels}
                />
              </fieldset>
            ))}
          </div>
          <div className={cn(panelClass, "space-y-4")}>
            <h2 className="text-xl font-semibold">{labels.exceptions}</h2>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={labels.date}>
                <input
                  type="date"
                  className={fieldClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <button
                type="button"
                disabled={!date || date in draft.exceptions}
                className={buttonClass}
                onClick={() => {
                  change({ ...draft, exceptions: { ...draft.exceptions, [date]: [] } });
                  setDate("");
                }}
              >
                <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.addException}
              </button>
            </div>
            {Object.entries(draft.exceptions)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, hours]) => (
                <fieldset key={day} className="space-y-3 rounded-xl border border-border p-4">
                  <legend className="px-2 font-medium">{day}</legend>
                  <HoursEditor
                    value={hours}
                    labels={labels}
                    onChange={(next) =>
                      change({ ...draft, exceptions: { ...draft.exceptions, [day]: next } })
                    }
                  />
                  <button
                    type="button"
                    className={cn(buttonClass, "size-10 p-0")}
                    aria-label={`${labels.remove} ${day}`}
                    onClick={() => {
                      const exceptions = { ...draft.exceptions };
                      delete exceptions[day];
                      change({ ...draft, exceptions });
                    }}
                  >
                    <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                </fieldset>
              ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        <button className={primaryClass} disabled={action.busy}>
          {action.busy ? labels.saving : labels.save}
        </button>
        {draft.version > 0 && !draft.archived && (
          <ArchiveButton labels={labels} onClick={() => setArchiving(true)} />
        )}
        {draft.archived && <span>{labels.archived}</span>}
      </div>
      {archiving && (
        <ArchiveDialog
          labels={labels}
          action={action}
          onClose={() => setArchiving(false)}
          onArchive={() => save(true)}
        />
      )}
    </form>
  );
}

function ArchiveButton({ labels, onClick }: { labels: ReservationLabels; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(buttonClass, "size-10 p-0 text-destructive")}
      aria-label={labels.archive}
      onClick={onClick}
    >
      <Trash2Icon className="size-4 shrink-0" aria-hidden="true" />
    </button>
  );
}
function ArchiveDialog({
  labels,
  action,
  onClose,
  onArchive,
}: {
  labels: ReservationLabels;
  action: ReturnType<typeof useReservationAction>;
  onClose: () => void;
  onArchive: () => Promise<void>;
}) {
  return (
    <Modal
      title={labels.archive}
      description={labels.archiveConfirm}
      onClose={onClose}
      busy={action.busy}
    >
      <ErrorNotice error={action.error} labels={labels} />
      <div className="flex gap-3">
        <button
          type="button"
          className={cn(buttonClass, "hover:bg-primary/5 hover:text-primary")}
          onClick={onClose}
          disabled={action.busy}
        >
          {labels.back}
        </button>
        <button
          type="button"
          className={primaryClass}
          disabled={action.busy}
          onClick={() => {
            void action.run(onArchive);
          }}
        >
          {labels.archive}
        </button>
      </div>
    </Modal>
  );
}

export function ReservationSettingsPage(props: ReservationSettingsPageProps) {
  return (
    <ActionToastProvider>
      <ReservationSettingsPageContent {...props} />
    </ActionToastProvider>
  );
}
