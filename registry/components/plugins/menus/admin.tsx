"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import { Link, type LinkProps } from "@/components/link";
import { DriveBrowser, type DriveClient, type DriveEntry } from "@/components/plugins/drive";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import { parsePrice } from "@/components/plugins/menus/model";
import type {
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
} from "@/components/plugins/menus/types";
import { cn } from "@/components/utils/cn";

const field =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";
const primary = cn(button, "border-primary bg-primary text-primary-foreground");
const page = "mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-foreground";
const iconButton = cn(button, "size-10 p-0");
const editorLocales = (locales: readonly { code: string; name: string }[], baseLocale: string) =>
  locales.some((locale) => locale.code === baseLocale)
    ? locales
    : [{ code: baseLocale, name: baseLocale }, ...locales];

function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function DeleteControl({
  label,
  confirm,
  cancel,
  errorMessage,
  onDelete,
  onDone,
}: {
  label: string;
  confirm: string;
  cancel: string;
  errorMessage: string;
  onDelete: () => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <Dialog.Trigger className={iconButton} aria-label={label}>
        <Trash2Icon aria-hidden="true" className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{label}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {confirm}?
          </Dialog.Description>
          {error ? <ErrorMessage message={errorMessage} /> : null}
          <div className="flex justify-end gap-2">
            <Dialog.Close className={button} disabled={pending}>
              {cancel}
            </Dialog.Close>
            <button
              type="button"
              className={cn(
                primary,
                "border-destructive bg-destructive text-destructive-foreground",
              )}
              disabled={pending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                setPending(true);
                setError(false);
                void onDelete()
                  .then(() => {
                    setOpen(false);
                    onDone();
                  })
                  .catch(() => setError(true))
                  .finally(() => {
                    lock.current = false;
                    setPending(false);
                  });
              }}
            >
              {confirm}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface MenuItemsPageProps {
  client: MenusClient;
  baseLocale: string;
  newHref: string;
  taxonomyHref: string;
  getEditHref: (item: MenuItem) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuItemsPage({
  client,
  baseLocale,
  newHref,
  taxonomyHref,
  getEditHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuItemsPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ items: MenuItem[]; categories: MenuCategory[] }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([client.list(), client.categories()])
      .then(([items, categories]) => {
        if (active) {
          setData({ items, categories });
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, revision]);
  const categoryNames = new Map(
    data?.categories.map((category) => [category.id, category.translations[baseLocale]]) ?? [],
  );
  return (
    <section className={cn(page, className)}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{labels.items}</h1>
        <div className="flex gap-2">
          <HostLink href={taxonomyHref} className={button}>
            {labels.categories} / {labels.labels}
          </HostLink>
          <HostLink href={newHref} className={primary}>
            <PlusIcon aria-hidden="true" className="size-4" />
            {labels.newItem}
          </HostLink>
        </div>
      </header>
      {error ? (
        <div>
          <ErrorMessage message={labels.error} />
          <button className={button} onClick={() => setRevision((n) => n + 1)}>
            {labels.retry}
          </button>
        </div>
      ) : null}
      {!data && !error ? <output>{labels.loading}</output> : null}
      {data?.items.length === 0 ? <p>{labels.emptyItems}</p> : null}
      {data?.items.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">
                  {labels.name}
                </th>
                <th scope="col" className="p-3">
                  {labels.category}
                </th>
                <th scope="col" className="p-3">
                  {labels.visible}
                </th>
                <th scope="col" className="p-3">
                  {labels.unavailable}
                </th>
                <th scope="col" className="p-3 text-right">
                  {labels.editItem}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="p-3 font-medium">{item.translations[baseLocale]?.name}</td>
                  <td className="p-3">{categoryNames.get(item.categoryId)}</td>
                  <td className="p-3">{item.visible ? labels.yes : labels.no}</td>
                  <td className="p-3">{item.soldOut ? labels.yes : labels.no}</td>
                  <td className="flex justify-end gap-2 p-3">
                    <HostLink
                      href={getEditHref(item)}
                      className={iconButton}
                      aria-label={`${labels.editItem}: ${item.translations[baseLocale]?.name}`}
                    >
                      <PencilIcon aria-hidden="true" className="size-4" />
                    </HostLink>
                    <DeleteControl
                      label={`${labels.deleteItem}: ${item.translations[baseLocale]?.name}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      errorMessage={labels.deleteFilesFirst}
                      onDelete={() => client.remove(item.id)}
                      onDone={() => setRevision((n) => n + 1)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export interface MenuItemEditorPageProps {
  client: MenusClient;
  item?: MenuItem;
  categories: readonly MenuCategory[];
  labelsData: readonly MenuLabel[];
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  currency: string;
  backHref: string;
  onSaved: (item: MenuItem) => void;
  driveClient?: DriveClient;
  driveTransfer?: DriveTransfer;
  photoFolderId?: string | null;
  getFolderHref?: (folderId: string | null) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

export function MenuItemEditorPage({
  client,
  item,
  categories,
  labelsData,
  locales,
  baseLocale,
  currency,
  backHref,
  onSaved,
  driveClient,
  driveTransfer,
  photoFolderId,
  getFolderHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuItemEditorPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [draft, setDraft] = useState<MenuItemInput>(() =>
    item
      ? {
          categoryId: item.categoryId,
          priceMinor: item.priceMinor,
          position: item.position,
          visible: item.visible,
          soldOut: item.soldOut,
          imageEntryId: item.imageEntryId,
          labelIds: [...item.labelIds],
          translations: { ...item.translations },
        }
      : {
          categoryId: categories[0]?.id ?? "",
          priceMinor: 0,
          position: 0,
          visible: false,
          soldOut: false,
          imageEntryId: null,
          labelIds: [],
          translations: { [baseLocale]: { name: "", description: "" } },
        },
  );
  const [selectedLocale, setSelectedLocale] = useState(baseLocale);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [photoName, setPhotoName] = useState("");
  const [savedVersion, setSavedVersion] = useState(item?.version);
  const lock = useRef(false);
  const formatter = new Intl.NumberFormat(baseLocale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const [price, setPrice] = useState((draft.priceMinor / 10 ** digits).toFixed(digits));
  const updateTranslation = (locale: string, patch: Partial<MenuItem["translations"][string]>) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...(current.translations[locale] ?? { name: "", description: "" }), ...patch },
      },
    }));
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFeedback(undefined);
    try {
      if (!draft.translations[baseLocale]?.name.trim()) {
        setSelectedLocale(baseLocale);
        setFeedback({ error: true, text: labels.baseNameRequired });
        return;
      }
      const input = { ...draft, priceMinor: parsePrice(price, digits) };
      const saved = item
        ? await client.save(item.id, savedVersion ?? item.version, input)
        : await client.create(input);
      setSavedVersion(saved.version);
      setFeedback({ error: false, text: labels.saved });
      onSaved(saved);
    } catch {
      setFeedback({ error: true, text: labels.error });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <section className={cn(page, className)}>
      <HostLink href={backHref} className={button}>
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">{item ? labels.editItem : labels.newItem}</h1>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span>{labels.category}</span>
            <select
              className={field}
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.translations[baseLocale]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span>
              {labels.price} ({currency})
            </span>
            <input
              className={field}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1">
            <span>{labels.position}</span>
            <input
              className={field}
              type="number"
              min="0"
              step="1"
              value={draft.position}
              onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })}
              required
            />
          </label>
        </div>
        <Tabs.Root
          value={selectedLocale}
          onValueChange={(value) => setSelectedLocale(value as string)}
        >
          <Tabs.List
            aria-label={labels.language}
            className="flex gap-1 overflow-x-auto border-b border-border"
          >
            {editorLocales(locales, baseLocale).map((locale) => (
              <Tabs.Tab
                key={locale.code}
                type="button"
                value={locale.code}
                className="min-h-11 shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground focus-visible:rounded-t-md focus-visible:outline-2 focus-visible:outline-ring data-[active]:border-primary data-[active]:text-foreground"
              >
                {locale.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {editorLocales(locales, baseLocale).map((locale) => {
            const translation = draft.translations[locale.code] ?? { name: "", description: "" };
            return (
              <Tabs.Panel key={locale.code} value={locale.code} className="space-y-4 pt-4">
                <label className="block space-y-1">
                  <span>
                    {labels.name}
                    {locale.code === baseLocale ? " *" : ""}
                  </span>
                  <input
                    className={field}
                    value={translation.name}
                    onChange={(event) =>
                      updateTranslation(locale.code, { name: event.target.value })
                    }
                    maxLength={200}
                    required={locale.code === baseLocale}
                  />
                </label>
                <label className="block space-y-1">
                  <span>{labels.description}</span>
                  <textarea
                    className={field}
                    rows={4}
                    value={translation.description}
                    onChange={(event) =>
                      updateTranslation(locale.code, { description: event.target.value })
                    }
                    maxLength={2000}
                  />
                </label>
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
        <fieldset className="space-y-2">
          <legend className="font-medium">{labels.labels}</legend>
          <div className="flex flex-wrap gap-4">
            {labelsData.map((label) => (
              <label key={label.id} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.labelIds.includes(label.id)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      labelIds: event.target.checked
                        ? [...current.labelIds, label.id]
                        : current.labelIds.filter((id) => id !== label.id),
                    }))
                  }
                />
                {label.translations[baseLocale]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-5">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(event) => setDraft({ ...draft, visible: event.target.checked })}
              disabled={!item}
            />
            {labels.visible}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.soldOut}
              onChange={(event) => setDraft({ ...draft, soldOut: event.target.checked })}
            />
            {labels.unavailable}
          </label>
        </div>
        {draft.imageEntryId ? (
          <div className="flex items-center gap-3 text-sm">
            <span>
              {labels.photo}: {photoName || draft.imageEntryId}
            </span>
            <button
              type="button"
              className={button}
              onClick={() => setDraft({ ...draft, imageEntryId: null })}
            >
              {labels.removePhoto}
            </button>
          </div>
        ) : null}
        {feedback ? (
          <p
            role={feedback.error ? "alert" : "status"}
            className={feedback.error ? "text-destructive" : "text-muted-foreground"}
          >
            {feedback.text}
          </p>
        ) : null}
        <button type="submit" className={primary} disabled={pending || !categories.length}>
          {pending ? labels.saving : labels.save}
        </button>
      </form>
      {item && driveClient && getFolderHref ? (
        <div className="border-t border-border pt-6">
          <h2 className="mb-4 text-xl font-semibold">{labels.photo}</h2>
          <DriveBrowser
            client={driveClient}
            transferUpload={driveTransfer}
            scope={{ type: "menu-item", id: item.id }}
            parentId={photoFolderId}
            getFolderHref={getFolderHref}
            linkComponent={HostLink}
            onSelectFile={(entry) => {
              setDraft({ ...draft, imageEntryId: entry.id });
              setPhotoName(entry.name);
            }}
            isSelectableFile={(entry: DriveEntry) =>
              ["image/jpeg", "image/png", "image/webp"].includes(entry.contentType) &&
              entry.size <= 10_000_000
            }
            selectFileLabel={labels.selectPhoto}
            uploadAccept="image/jpeg,image/png,image/webp"
          />
        </div>
      ) : null}
    </section>
  );
}

export interface MenuTaxonomyPageProps {
  client: MenusClient;
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

function TaxonomyDialog({
  kind,
  existing,
  locales,
  baseLocale,
  labels,
  onSave,
}: {
  kind: "category" | "label";
  existing?: MenuCategory | MenuLabel;
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  labels: MenusLabels;
  onSave: (data: {
    id?: string;
    position: number;
    translations: Record<string, string>;
    kind?: MenuLabel["kind"];
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(existing?.position ?? 0);
  const [translations, setTranslations] = useState<Record<string, string>>(
    existing?.translations ?? {},
  );
  const [labelKind, setLabelKind] = useState<MenuLabel["kind"]>(
    existing && "kind" in existing ? existing.kind : "allergen",
  );
  const title =
    kind === "category"
      ? existing
        ? labels.editCategory
        : labels.newCategory
      : existing
        ? labels.editLabel
        : labels.newLabel;
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <Dialog.Trigger className={existing ? iconButton : button} aria-label={title}>
        {existing ? (
          <PencilIcon aria-hidden="true" className="size-4" />
        ) : (
          <>
            <PlusIcon aria-hidden="true" className="size-4" />
            {title}
          </>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setError(false);
              void onSave({
                id: existing?.id,
                position,
                translations,
                ...(kind === "label" ? { kind: labelKind } : {}),
              })
                .then(() => setOpen(false))
                .catch(() => setError(true))
                .finally(() => setPending(false));
            }}
          >
            {editorLocales(locales, baseLocale).map((locale) => (
              <label key={locale.code} className="block space-y-1">
                <span>
                  {labels.name} ({locale.name}){locale.code === baseLocale ? " *" : ""}
                </span>
                <input
                  className={field}
                  value={translations[locale.code] ?? ""}
                  onChange={(event) =>
                    setTranslations({ ...translations, [locale.code]: event.target.value })
                  }
                  required={locale.code === baseLocale}
                  maxLength={120}
                />
              </label>
            ))}
            <label className="block space-y-1">
              <span>{labels.position}</span>
              <input
                className={field}
                type="number"
                min="0"
                step="1"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                required
              />
            </label>
            {kind === "label" ? (
              <label className="block space-y-1">
                <span>{labels.labelKind}</span>
                <select
                  className={field}
                  value={labelKind}
                  onChange={(event) => setLabelKind(event.target.value as MenuLabel["kind"])}
                >
                  <option value="allergen">{labels.allergens}</option>
                  <option value="dietary">{labels.dietary}</option>
                </select>
              </label>
            ) : null}
            {error ? <ErrorMessage message={labels.error} /> : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close className={button} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button className={primary} disabled={pending}>
                {pending ? labels.saving : labels.save}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MenuTaxonomyPage({
  client,
  locales,
  baseLocale,
  backHref,
  linkComponent: HostLink = Link,
  labels: overrides,
  className,
}: MenuTaxonomyPageProps) {
  const labels = { ...menusLabels, ...overrides };
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ categories: MenuCategory[]; labelsData: MenuLabel[] }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([client.categories(), client.labels()])
      .then(([categories, labelsData]) => {
        if (active) {
          setData({ categories, labelsData });
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, revision]);
  const refresh = () => setRevision((n) => n + 1);
  return (
    <section className={cn(page, className)}>
      <HostLink href={backHref} className={button}>
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">
        {labels.categories} / {labels.labels}
      </h1>
      {error ? (
        <div>
          <ErrorMessage message={labels.error} />
          <button className={button} onClick={refresh}>
            {labels.retry}
          </button>
        </div>
      ) : null}
      {!data && !error ? <output>{labels.loading}</output> : null}
      {data ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{labels.categories}</h2>
              <TaxonomyDialog
                key="new-category"
                kind="category"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await client.saveCategory({
                    position: input.position,
                    translations: input.translations,
                  });
                  refresh();
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {data.categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between p-3">
                  <span>{category.translations[baseLocale]}</span>
                  <div className="flex gap-2">
                    <TaxonomyDialog
                      key={category.id}
                      kind="category"
                      existing={category}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await client.saveCategory({
                          id: category.id,
                          position: input.position,
                          translations: input.translations,
                        });
                        refresh();
                      }}
                    />
                    <DeleteControl
                      label={`${labels.deleteCategory}: ${category.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      errorMessage={labels.error}
                      onDelete={() => client.removeCategory(category.id)}
                      onDone={refresh}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{labels.labels}</h2>
              <TaxonomyDialog
                key="new-label"
                kind="label"
                locales={locales}
                baseLocale={baseLocale}
                labels={labels}
                onSave={async (input) => {
                  await client.saveLabel({
                    kind: input.kind ?? "allergen",
                    position: input.position,
                    translations: input.translations,
                  });
                  refresh();
                }}
              />
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {data.labelsData.map((label) => (
                <li key={label.id} className="flex items-center justify-between p-3">
                  <span>
                    {label.translations[baseLocale]}{" "}
                    <span className="text-xs text-muted-foreground">({label.kind})</span>
                  </span>
                  <div className="flex gap-2">
                    <TaxonomyDialog
                      key={label.id}
                      kind="label"
                      existing={label}
                      locales={locales}
                      baseLocale={baseLocale}
                      labels={labels}
                      onSave={async (input) => {
                        await client.saveLabel({
                          id: label.id,
                          kind: input.kind ?? label.kind,
                          position: input.position,
                          translations: input.translations,
                        });
                        refresh();
                      }}
                    />
                    <DeleteControl
                      label={`${labels.deleteLabel}: ${label.translations[baseLocale]}`}
                      confirm={labels.confirmDelete}
                      cancel={labels.cancel}
                      errorMessage={labels.error}
                      onDelete={() => client.removeLabel(label.id)}
                      onDone={refresh}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
