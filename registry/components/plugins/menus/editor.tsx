"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { XIcon, ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
} from "react";

import { useActionToast, ActionToastProvider } from "@/components/action-toast";
import { IconTooltip } from "@/components/icon-tooltip";
import { Link, type LinkProps } from "@/components/link";
import { NativeSelect } from "@/components/native-select";
import { DriveBrowser, type DriveClient, type DriveEntry } from "@/components/plugins/drive";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import { MenuLabelBadge, MenuLabelSymbol } from "@/components/plugins/menus/label-badge";
import { menuLabelIcons, type MenuLabelIcon } from "@/components/plugins/menus/label-presets";
import { menusLabels, type MenusLabels } from "@/components/plugins/menus/labels";
import { parsePrice } from "@/components/plugins/menus/model";
import { MenuSpiceBadge } from "@/components/plugins/menus/spice-badge";
import type {
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MenuLabel,
  MenusClient,
} from "@/components/plugins/menus/types";
import {
  field,
  button,
  outlineButton,
  primary,
  page,
  iconButton,
  ErrorMessage,
  DeleteControl,
} from "@/components/plugins/menus/ui";
import { cn } from "@/components/utils/cn";
import { submitDialogOnShortcut } from "@/components/utils/dialog-submit";
import { editorActionsClass, useEditorValidation } from "@/components/utils/editor-form";
const editorLocales = (locales: readonly { code: string; name: string }[], baseLocale: string) =>
  locales.some((locale) => locale.code === baseLocale)
    ? locales
    : [{ code: baseLocale, name: baseLocale }, ...locales];

export interface MenuItemEditorPageProps {
  /** Keep stable while editing; changing the client or item ID starts a fresh editor. */
  client: MenusClient;
  item?: MenuItem;
  categories: readonly MenuCategory[];
  labelsData: readonly MenuLabel[];
  locales: readonly { code: string; name: string }[];
  baseLocale: string;
  currency: string;
  backHref: string;
  /** Host route for label management; omit when unavailable to this user. */
  labelsHref?: string;
  /** Host router reports a blocked transition; the editor resolves it with its leave dialog. */
  blockedNavigation?: { proceed: () => void; reset: () => void };
  /** Host routers use this state for history blocking and native unload protection. */
  onNavigationStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
  onSaved: (item: MenuItem) => void;
  driveClient?: DriveClient;
  driveTransfer?: DriveTransfer;
  photoFolderId?: string | null;
  getFolderHref?: (folderId: string | null) => string;
  linkComponent?: ComponentType<LinkProps>;
  labels?: Partial<MenusLabels>;
  className?: string;
}

function MenuItemEditorPageContent({
  client,
  item,
  categories,
  labelsData,
  locales,
  baseLocale,
  currency,
  backHref,
  labelsHref,
  blockedNavigation,
  onNavigationStateChange,
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
  const { formRef, ...fields } = useEditorValidation();
  const id = `factory-menu-editor-${useId()}`;
  const [draft, setDraft] = useState<MenuItemInput>(() =>
    item
      ? {
          categoryId: item.categoryId,
          priceMinor: item.priceMinor,
          position: item.position,
          visible: item.visible,
          soldOut: item.soldOut,
          spiceLevel: item.spiceLevel ?? 0,
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
          spiceLevel: 0,
          imageEntryId: null,
          labelIds: [],
          translations: { [baseLocale]: { name: "", description: "" } },
        },
  );
  const [selectedLocale, setSelectedLocale] = useState(baseLocale);
  const sortedLabels = [...labelsData].sort((a, b) =>
    a.translations[baseLocale].localeCompare(b.translations[baseLocale], baseLocale, {
      sensitivity: "base",
    }),
  );
  const [pending, setPending] = useState(false);
  const notify = useActionToast();
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [photoName, setPhotoName] = useState("");
  const [savedVersion, setSavedVersion] = useState(item?.version);
  const lock = useRef(false);
  const formatter = new Intl.NumberFormat(baseLocale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const [price, setPrice] = useState((draft.priceMinor / 10 ** digits).toFixed(digits));
  const [sizes, setSizes] = useState(() =>
    (item?.sizes ?? []).map((size) => ({
      id: size.id,
      price: (size.priceMinor / 10 ** digits).toFixed(digits),
      translations: { ...size.translations },
    })),
  );
  const snapshot = JSON.stringify([draft, price, sizes]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const navigation = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      navigation.current = null;
    };
  }, []);
  const editor = useMenuEditorState(snapshot !== savedSnapshot, pending, onNavigationStateChange);
  function cancelNavigation() {
    if (lock.current) return;
    navigation.current = null;
    setLeaveOpen(false);
    blockedNavigation?.reset();
  }
  function guardNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    if (lock.current) {
      event.preventDefault();
      return;
    }
    if (snapshot !== savedSnapshot) {
      event.preventDefault();
      navigation.current = href;
      setLeaveOpen(true);
    }
  }
  function discardAndLeave() {
    const href = navigation.current;
    navigation.current = null;
    setLeaveOpen(false);
    editor.resume(() => {
      if (blockedNavigation) blockedNavigation.proceed();
      else if (href) window.location.assign(href);
    });
  }
  const updateTranslation = (locale: string, patch: Partial<MenuItem["translations"][string]>) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...(current.translations[locale] ?? { name: "", description: "" }), ...patch },
      },
    }));
  async function submit(continueNavigation = false) {
    if (lock.current) return;
    const issues: Record<string, string> = {};
    if (!draft.translations[baseLocale]?.name.trim()) {
      issues[`${id}-name-${baseLocale}`] = labels.baseNameRequired;
    }
    for (const size of sizes) {
      if (!size.translations[baseLocale]?.trim()) {
        issues[`${id}-size-${size.id}-${baseLocale}`] = labels.baseSizeNameRequired;
      }
    }
    for (const [key, value] of sizes.length
      ? sizes.map((size) => [`${id}-price-${size.id}`, size.price])
      : [[`${id}-price`, price]]) {
      try {
        parsePrice(value, digits);
      } catch {
        issues[key] = labels.priceInvalid;
      }
    }
    if (Object.keys(issues).some((key) => key.endsWith(`-${baseLocale}`))) {
      setSelectedLocale(baseLocale);
    }
    if (!fields.validate(issues)) {
      cancelNavigation();
      return;
    }
    lock.current = true;
    setPending(true);
    setFeedback(undefined);
    try {
      const sizePrices = sizes.map((size) => ({
        id: size.id,
        priceMinor: parsePrice(size.price, digits),
        translations: size.translations,
      }));
      const input = {
        ...draft,
        priceMinor: sizePrices[0]?.priceMinor ?? parsePrice(price, digits),
        sizes: sizePrices,
      };
      const saved = item
        ? await client.save(item.id, savedVersion ?? item.version, input)
        : await client.create(input);
      if (!editor.isActive()) return;
      const href = continueNavigation ? navigation.current : null;
      const proceed =
        continueNavigation && editor.isActive() ? blockedNavigation?.proceed : undefined;
      setSavedSnapshot(snapshot);
      setSavedVersion(saved.version);
      notify(labels.saved);
      if (href || proceed) {
        navigation.current = null;
        setLeaveOpen(false);
        editor.resume(() => {
          onSaved(saved);
          if (proceed) proceed();
          else if (href) window.location.assign(href);
        });
      } else onSaved(saved);
    } catch {
      if (editor.isActive()) setFeedback({ error: true, text: labels.error });
    } finally {
      lock.current = false;
      if (editor.isActive()) setPending(false);
    }
  }
  return (
    <section className={cn(page, className)}>
      <HostLink
        href={backHref}
        className={cn(button, "hover:bg-primary/5 hover:text-primary aria-disabled:opacity-50")}
        aria-disabled={pending || undefined}
        onClick={(event) => guardNavigation(event, backHref)}
      >
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        {labels.back}
      </HostLink>
      <h1 className="text-2xl font-semibold">{item ? labels.editItem : labels.newItem}</h1>
      <MenuLeaveDialog
        open={leaveOpen || !!blockedNavigation}
        pending={pending}
        labels={labels}
        error={feedback?.error ? feedback.text : undefined}
        saveDisabled={!categories.length}
        onCancel={cancelNavigation}
        onDiscard={discardAndLeave}
        onSave={() => void submit(true)}
      />
      <form
        ref={formRef}
        noValidate
        onChange={(event) => fields.clear(event.target.id)}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span>{labels.category}</span>
            <NativeSelect
              className={field}
              {...fields.field(`${id}-category`)}
              aria-label={labels.category}
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.translations[baseLocale]}
                </option>
              ))}
            </NativeSelect>
            {fields.message(`${id}-category`)}
          </label>
          {sizes.length === 0 ? (
            <label className="space-y-1">
              <span>
                {labels.price} ({currency})
              </span>
              <input
                className={field}
                inputMode="decimal"
                {...fields.field(`${id}-price`)}
                aria-label={`${labels.price} (${currency})`}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
              {fields.message(`${id}-price`)}
            </label>
          ) : null}
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
                className="min-h-11 shrink-0 cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground focus-visible:rounded-t-md focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed data-[active]:border-primary data-[active]:text-foreground"
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
                    {...fields.field(`${id}-name-${locale.code}`)}
                    aria-label={`${labels.name}${locale.code === baseLocale ? " *" : ""}`}
                    value={translation.name}
                    onChange={(event) =>
                      updateTranslation(locale.code, { name: event.target.value })
                    }
                    maxLength={200}
                    required={locale.code === baseLocale}
                  />
                  {fields.message(`${id}-name-${locale.code}`)}
                </label>
                <label className="block space-y-1">
                  <span>{labels.description}</span>
                  <textarea
                    className={field}
                    rows={4}
                    {...fields.field(`${id}-description-${locale.code}`)}
                    aria-label={labels.description}
                    value={translation.description}
                    onChange={(event) =>
                      updateTranslation(locale.code, { description: event.target.value })
                    }
                    maxLength={2000}
                  />
                  {fields.message(`${id}-description-${locale.code}`)}
                </label>
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-medium">{labels.sizes}</legend>
          <p className="text-sm text-muted-foreground">{labels.sizeHelp}</p>
          {sizes.map((size, index) => (
            <div key={size.id} className="flex items-end gap-2 rounded-xl border border-border p-3">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 space-y-1">
                  <span>
                    {labels.sizeName} ({selectedLocale}) {index + 1}
                  </span>
                  <input
                    className={field}
                    {...fields.field(`${id}-size-${size.id}-${selectedLocale}`)}
                    aria-label={`${labels.sizeName} (${selectedLocale}) ${index + 1}`}
                    value={size.translations[selectedLocale] ?? ""}
                    maxLength={120}
                    onChange={(event) =>
                      setSizes((current) =>
                        current.map((entry) =>
                          entry.id === size.id
                            ? {
                                ...entry,
                                translations: {
                                  ...entry.translations,
                                  [selectedLocale]: event.target.value,
                                },
                              }
                            : entry,
                        ),
                      )
                    }
                  />
                  {fields.message(`${id}-size-${size.id}-${selectedLocale}`)}
                </label>
                <label className="min-w-0 space-y-1">
                  <span>
                    {labels.price} ({currency}) {index + 1}
                  </span>
                  <input
                    className={field}
                    inputMode="decimal"
                    {...fields.field(`${id}-price-${size.id}`)}
                    aria-label={`${labels.price} (${currency}) ${index + 1}`}
                    value={size.price}
                    required
                    onChange={(event) =>
                      setSizes((current) =>
                        current.map((entry) =>
                          entry.id === size.id ? { ...entry, price: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  {fields.message(`${id}-price-${size.id}`)}
                </label>
              </div>
              <DeleteControl
                label={`${labels.removeSize}: ${size.translations[baseLocale] || index + 1}`}
                confirm={labels.confirmDelete}
                cancel={labels.cancel}
                closeLabel={labels.close}
                errorMessage={labels.error}
                onDelete={async () => {}}
                onDone={() =>
                  setSizes((current) => current.filter((entry) => entry.id !== size.id))
                }
              />
            </div>
          ))}
          <button
            type="button"
            className={outlineButton}
            disabled={sizes.length >= 20}
            onClick={() =>
              setSizes((current) => [
                ...current,
                { id: crypto.randomUUID(), price, translations: { [baseLocale]: "" } },
              ])
            }
          >
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
            {labels.addSize}
          </button>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium">{labels.spiceLevel}</legend>
          <div className="flex flex-wrap gap-2">
            {([0, 1, 2, 3] as const).map((level) => (
              <label
                key={level}
                className={cn(
                  "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2",
                  draft.spiceLevel === level && "ring-2 ring-ring",
                )}
              >
                <input
                  type="radio"
                  name="spiceLevel"
                  value={level}
                  checked={draft.spiceLevel === level}
                  className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={() => setDraft((current) => ({ ...current, spiceLevel: level }))}
                />
                {level === 0 ? labels.notSpicy : <MenuSpiceBadge level={level} labels={labels} />}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-medium">
            <span className="inline-flex items-center gap-2">
              {labels.labels}
              {labelsHref && (
                <IconTooltip label={labels.manageLabels}>
                  <HostLink
                    href={labelsHref}
                    className={cn(iconButton, "aria-disabled:opacity-50")}
                    aria-label={labels.manageLabels}
                    aria-disabled={pending || undefined}
                    onClick={(event) => guardNavigation(event, labelsHref)}
                  >
                    <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                  </HostLink>
                </IconTooltip>
              )}
            </span>
          </legend>
          <div className="flex flex-wrap gap-4">
            {sortedLabels.map((label) => (
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
                <MenuLabelBadge label={{ ...label, name: label.translations[baseLocale] }} />
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
        <div className={editorActionsClass}>
          <button type="submit" className={primary} disabled={pending || !categories.length}>
            {pending ? labels.saving : labels.save}
          </button>
        </div>
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

function MenuLeaveDialog({
  open,
  pending,
  labels,
  error,
  saveDisabled = false,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  pending: boolean;
  labels: MenusLabels;
  error?: string;
  saveDisabled?: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 scroll-py-32 space-y-5 overflow-y-auto rounded-2xl border border-border bg-popover px-6 text-popover-foreground shadow-xl">
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-popover px-6 pt-5 pb-2"
          >
            <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
              {labels.unsavedTitle}
            </Dialog.Title>
            <IconTooltip label={labels.cancel}>
              <Dialog.Close
                type="button"
                aria-label={labels.cancel}
                className={iconButton}
                disabled={pending}
              >
                <XIcon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <Dialog.Description className="text-sm text-muted-foreground">
            {labels.unsavedDescription}
          </Dialog.Description>
          <ErrorMessage message={error} />
          <div
            data-dialog-footer
            className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-popover px-6 pt-0 pb-5"
          >
            <Dialog.Close className={outlineButton} disabled={pending}>
              {labels.cancel}
            </Dialog.Close>
            <button type="button" className={outlineButton} disabled={pending} onClick={onDiscard}>
              {labels.discardChanges}
            </button>
            <button
              type="button"
              className={primary}
              disabled={pending || saveDisabled}
              onClick={onSave}
            >
              {pending ? labels.saving : labels.save}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface MenuTaxonomyEditorProps {
  disabled?: boolean;
  blockedNavigation?: MenuItemEditorPageProps["blockedNavigation"];
  onNavigationStateChange?: MenuItemEditorPageProps["onNavigationStateChange"];
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
    icon?: MenuLabelIcon | null;
  }) => Promise<void>;
}

export function MenuTaxonomyEditor({
  disabled = false,
  kind,
  existing,
  locales,
  baseLocale,
  labels,
  onSave,
  blockedNavigation,
  onNavigationStateChange,
}: MenuTaxonomyEditorProps) {
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
  const [icon, setIcon] = useState<MenuLabelIcon | null>(
    existing && "kind" in existing ? (existing.icon ?? null) : null,
  );
  const snapshot = JSON.stringify([position, translations, labelKind, icon]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const form = useRef<HTMLFormElement>(null);
  const lock = useRef(false);
  const editor = useMenuEditorState(
    snapshot !== savedSnapshot,
    pending,
    onNavigationStateChange,
    open,
  );
  async function submit(leaving = false) {
    if (lock.current || disabled) return;
    if (!form.current?.checkValidity()) {
      blockedNavigation?.reset();
      requestAnimationFrame(() => form.current?.reportValidity());
      return;
    }
    lock.current = true;
    setPending(true);
    setError(false);
    try {
      await onSave({
        id: existing?.id,
        position,
        translations,
        ...(kind === "label" ? { kind: labelKind, icon } : {}),
      });
      if (!editor.isActive()) return;
      setSavedSnapshot(snapshot);
      setOpen(false);
      if (leaving && blockedNavigation) editor.resume(blockedNavigation.proceed);
    } catch {
      if (editor.isActive()) setError(true);
    } finally {
      lock.current = false;
      if (editor.isActive()) setPending(false);
    }
  }
  const iconNames = { ...menusLabels.iconNames, ...labels.iconNames };
  const title =
    kind === "category"
      ? existing
        ? labels.editCategory
        : labels.newCategory
      : existing
        ? labels.editLabel
        : labels.newLabel;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => !pending && !blockedNavigation && setOpen(value)}
    >
      <IconTooltip label={existing ? title : undefined}>
        <Dialog.Trigger
          disabled={disabled}
          className={existing ? iconButton : primary}
          aria-label={title}
        >
          {existing ? (
            <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <>
              <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
              {title}
            </>
          )}
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          onKeyDownCapture={submitDialogOnShortcut}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 scroll-py-32 overflow-y-auto rounded-2xl border border-border bg-popover px-6 text-popover-foreground shadow-xl"
        >
          <div
            data-dialog-header
            className="sticky top-0 z-20 -mx-6 mb-0 flex items-start justify-between gap-3 bg-popover px-6 pt-5 pb-2"
          >
            <Dialog.Title className="min-w-0 flex-1 text-lg font-semibold break-words">
              {title}
            </Dialog.Title>
            <IconTooltip label={labels.close ?? labels.cancel}>
              <Dialog.Close
                type="button"
                aria-label={labels.close ?? labels.cancel}
                disabled={pending}
                className={iconButton}
              >
                <XIcon className="size-4 shrink-0" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <form
            className="contents space-y-4 [&>:first-child]:mt-2"
            ref={form}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
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
              <>
                <label className="block space-y-1">
                  <span>{labels.labelKind}</span>
                  <NativeSelect
                    className={field}
                    value={labelKind}
                    onChange={(event) => setLabelKind(event.target.value as MenuLabel["kind"])}
                  >
                    <option value="allergen">{labels.allergens}</option>
                    <option value="dietary">{labels.dietary}</option>
                  </NativeSelect>
                </label>
                <label className="block space-y-1">
                  <span>{labels.icon}</span>
                  <span className="flex items-center gap-3">
                    <MenuLabelSymbol
                      label={{
                        id: existing?.id ?? "",
                        name: translations[baseLocale] ?? "",
                        kind: labelKind,
                        icon,
                      }}
                    />
                    <NativeSelect
                      className={field}
                      value={icon ?? ""}
                      onChange={(event) =>
                        setIcon((event.target.value || null) as MenuLabelIcon | null)
                      }
                    >
                      <option value="">{labels.automaticIcon}</option>
                      {[...menuLabelIcons]
                        .sort((a, b) => iconNames[a].localeCompare(iconNames[b], baseLocale))
                        .map((value) => (
                          <option key={value} value={value}>
                            {iconNames[value]}
                          </option>
                        ))}
                    </NativeSelect>
                  </span>
                </label>
              </>
            ) : null}
            {error ? <ErrorMessage message={labels.error} /> : null}
            <div
              data-dialog-footer
              className="sticky bottom-0 z-10 -mx-6 flex flex-wrap justify-end gap-2 bg-popover px-6 pt-0 pb-5"
            >
              <Dialog.Close className={outlineButton} disabled={pending}>
                {labels.cancel}
              </Dialog.Close>
              <button className={primary} disabled={pending}>
                {pending ? labels.saving : labels.save}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
      <MenuLeaveDialog
        open={open && !!blockedNavigation}
        pending={pending}
        labels={labels}
        error={error ? labels.error : undefined}
        onCancel={() => {
          if (!pending) blockedNavigation?.reset();
        }}
        onDiscard={() => {
          if (!pending && blockedNavigation) editor.resume(blockedNavigation.proceed);
        }}
        onSave={() => void submit(true)}
      />
    </Dialog.Root>
  );
}

export function MenuItemEditorPage(props: MenuItemEditorPageProps) {
  const [session, setSession] = useState({ client: props.client, id: props.item?.id, key: 0 });
  if (session.client !== props.client || session.id !== props.item?.id)
    setSession({ client: props.client, id: props.item?.id, key: session.key + 1 });
  return (
    <ActionToastProvider key={session.key}>
      <MenuItemEditorPageContent {...props} />
    </ActionToastProvider>
  );
}

/** Item and taxonomy forms keep their editing lifetime inside the Menu editor. */
function useMenuEditorState(
  dirty: boolean,
  pending: boolean,
  onNavigationStateChange: MenuItemEditorPageProps["onNavigationStateChange"],
  open = true,
) {
  const active = useRef(false);
  const state = useRef({ dirty: false, pending: false });
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    state.current = { dirty, pending };
    onNavigationStateChange?.(state.current);
    return () => onNavigationStateChange?.({ dirty: false, pending: false });
  }, [dirty, pending, open, onNavigationStateChange]);
  useEffect(() => {
    if (!open) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty || state.current.pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [open]);
  return {
    isActive: () => active.current,
    resume: (next: () => void) => {
      if (!active.current) return;
      state.current = { dirty: false, pending: false };
      onNavigationStateChange?.(state.current);
      next();
    },
  };
}
