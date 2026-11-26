"use client";

import { Tabs } from "@base-ui/react/tabs";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useId, useRef, useState, type ComponentType, type FormEvent } from "react";

import { ActionToastProvider, useActionToast } from "@/components/action-toast";
import { BackLink } from "@/components/back-link";
import { IconTooltip } from "@/components/icon-tooltip";
import type { LinkProps } from "@/components/link";
import { LoadingBadge, useLoadingActivity } from "@/components/loading-indicator";
import {
  productCategorySelection,
  productCategoryName,
  type ProductCategory,
  editableProductPrice,
  parseProductPrice,
  productPriceFormat,
  productImageSource,
  type ProductMedia,
  productSlugSchema,
  type Product,
  type ProductContent,
  type ProductsClient,
} from "@/components/plugins/products/model";
import {
  productButtonClass,
  productPrimaryClass,
  productsLabels,
  type ProductsLabels,
} from "@/components/plugins/products/presentation";
import { ProductCategoryTree } from "@/components/plugins/products/product-categories";
import { ProductMediaFields } from "@/components/plugins/products/product-media";
import { cn } from "@/components/utils/cn";
import { destructiveActionClass } from "@/components/utils/destructive-action";
import { submitFormOnShortcut } from "@/components/utils/dialog-submit";
import {
  editorActionsClass,
  editorInvalidClass,
  useEditorValidation,
} from "@/components/utils/editor-form";
import { useMutationAction } from "@/components/utils/use-optimistic-action";

export interface ProductFormProps {
  /** Omit when creating. Pass null while loading an existing record. */
  product?: Product | null;
  currency: string;
  locale?: string;
  /** The first language owns the primary fields and is the catalog fallback. */
  locales?: readonly { code: string; name: string }[];
  categories?: readonly ProductCategory[];
  labels?: ProductsLabels;
  /** Store the file and return its durable HTTPS URL or site-relative path. */
  uploadImage?: (file: File) => Promise<string>;
  imageUrl?: (src: string) => string;
  client: Pick<ProductsClient, "save" | "create">;
  onSaved?: (record: Product) => void;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  className?: string;
}

export function ProductForm(props: ProductFormProps) {
  return (
    <ActionToastProvider closeLabel={props.labels?.close}>
      <Editor key={props.product === null ? "loading" : (props.product?.id ?? "new")} {...props} />
    </ActionToastProvider>
  );
}

const inputClass = cn(
  "block min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
  editorInvalidClass,
);
const labelClass = "grid min-w-0 gap-1 text-sm font-medium";
const languageTabClass =
  "min-h-11 shrink-0 cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground focus-visible:rounded-t-md focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[active]:border-primary data-[active]:text-foreground";
type Draft = Omit<ProductContent, "characteristics"> & {
  pairs: (ProductContent["characteristics"][number] & { key: number })[];
};
function Editor({
  product,
  categories,
  client,
  currency,
  locale = "en",
  locales = [],
  labels: overrides,
  uploadImage,
  imageUrl,
  onSaved,
  backHref,
  linkComponent,
  className,
}: ProductFormProps) {
  const labels = { ...productsLabels, ...overrides };
  const format = productPriceFormat(currency, locale);
  const [base, setBase] = useState(product);
  const primary = locales[0]?.code ?? "en";
  const languages = locales.length ? locales.map(({ code }) => code) : [primary];
  const [language, setLanguage] = useState(() => (languages.includes(locale) ? locale : primary));
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      languages.map((code) => {
        const content = code === primary ? product : product?.translations?.[code];
        const draft: Draft = {
          name: content?.name ?? "",
          description: content?.description ?? "",
          pairs: content?.characteristics.map((pair, key) => ({ ...pair, key })) ?? [],
        };
        return [code, draft];
      }),
    ),
  );
  const { name, description, pairs } = drafts[language];
  const contentLanguage = locales.length ? language : locale;
  function changeDraft(change: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [language]: { ...current[language], ...change } }));
  }
  const [selectedIds, setCategoryIds] = useState(product?.categoryIds ?? []);
  const categoryIds = categories
    ? selectedIds.filter((id) => categories.some((c) => c.id === id))
    : selectedIds;
  const [media, setMedia] = useState<ProductMedia>(product?.media ?? {});
  const [uploading, setUploading] = useState(false);
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [price, setPrice] = useState(() =>
    editableProductPrice(product?.priceMinor ?? null, format),
  );
  const nextKey = useRef(Math.max(...Object.values(drafts).map((draft) => draft.pairs.length)));
  const validation = useEditorValidation();
  const { formRef, validate, field: fieldProps, clear, message } = validation;
  const action = useMutationAction(client);
  const notify = useActionToast();
  const prefix = `factory-product-form-${useId()}`;
  const nameField = (code: string) => `${prefix}-${code}-name`;
  const pairField = (code: string, key: number, field: string) =>
    `${prefix}-${code}-${key}-${field}`;
  const nameId = nameField(language);
  const slugId = prefix + "-slug";
  const priceId = prefix + "-price";
  const loading = product === null;
  useLoadingActivity(loading);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (action.pending || loading || uploading) return;
    const issues: Record<string, string> = {};
    const translations = Object.fromEntries(
      Object.entries(base?.translations ?? {}).filter(([code]) => !languages.includes(code)),
    );
    const content: Record<string, ProductContent> = {};
    let invalidLanguage: string | undefined;
    for (const code of languages) {
      const draft = drafts[code];
      const name = draft.name.trim();
      const description = draft.description.trim();
      if (code !== primary && !name && !description && !draft.pairs.length) continue;
      if (!name) {
        issues[nameField(code)] = labels.required;
        invalidLanguage ??= code;
      }
      const characteristics = draft.pairs.map(({ key, label, value }) => {
        const pair = { label: label.trim(), value: value.trim() };
        for (const field of ["label", "value"] as const) {
          if (!pair[field]) {
            issues[pairField(code, key, field)] = labels.required;
            invalidLanguage ??= code;
          }
        }
        return pair;
      });
      content[code] = { name, description, characteristics };
      if (code !== primary) translations[code] = content[code];
    }
    const savedMedia: ProductMedia = {};
    function photoForSave(photo: ProductMedia["banner"], slot: string | number) {
      if (!photo?.src.trim()) return;
      const result = productImageSource.safeParse(photo.src);
      if (result.success) return { src: result.data, alt: photo.alt.trim() };
      issues[`${prefix}-photo-${slot}`] = labels.imageUrlError;
    }
    for (const slot of ["banner", "thumbnail"] as const) {
      const photo = photoForSave(media[slot], slot);
      if (photo) savedMedia[slot] = photo;
    }
    const gallery = media.gallery?.flatMap((photo, index) => photoForSave(photo, index) ?? []);
    if (gallery?.length) savedMedia.gallery = gallery;
    const savedSlug = slug.trim() || null;
    if (savedSlug && !productSlugSchema.safeParse(savedSlug).success)
      issues[slugId] = labels.slugError;
    const priceMinor = parseProductPrice(price, format);
    if (priceMinor === undefined) issues[priceId] = labels.priceError;
    if (invalidLanguage) setLanguage(invalidLanguage);
    if (!validate(issues) || priceMinor === undefined) return;
    const input = {
      ...content[primary],
      slug: savedSlug,
      ...(categories && { categoryIds }),
      media: savedMedia,
      priceMinor,
      ...(locales.length > 1 && { translations }),
    };
    await action.run(
      () => (base ? client.save(base.id, base.version, input) : client.create(input)),
      (saved) => {
        setBase(saved);
        notify(labels.saved);
        onSaved?.(saved);
      },
    );
  }

  const errorCode =
    action.error && typeof action.error === "object" && "code" in action.error && action.error.code;
  const contentFields = (
    <div className="space-y-4">
      <div className="grid items-start gap-4 @md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={labelClass}>
          <label htmlFor={nameId}>
            {labels.name} {language === primary && <span aria-hidden="true">*</span>}
          </label>
          <input
            {...fieldProps(nameId)}
            className={inputClass}
            required={language === primary}
            maxLength={200}
            value={name}
            lang={contentLanguage}
            onChange={(e) => {
              changeDraft({ name: e.target.value });
              clear(nameId);
            }}
          />
          {message(nameId)}
        </div>
        <div className={labelClass}>
          <label htmlFor={slugId}>{labels.slug}</label>
          <input
            {...fieldProps(slugId)}
            className={inputClass}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              clear(slugId);
            }}
          />
          {message(slugId)}
        </div>
      </div>
      <label className={labelClass}>
        {labels.description}
        <textarea
          className={inputClass}
          rows={3}
          maxLength={10000}
          value={description}
          lang={contentLanguage}
          onChange={(e) => changeDraft({ description: e.target.value })}
        />
      </label>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-1 font-medium">{labels.characteristics}</legend>
        {pairs.map((pair) => (
          <div key={pair.key} className="flex items-end gap-2">
            {(["label", "value"] as const).map((field) => {
              const id = pairField(language, pair.key, field);
              return (
                <div key={field} className={cn(labelClass, "flex-1")}>
                  <label htmlFor={id}>
                    {labels[field]} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    {...fieldProps(id)}
                    className={inputClass}
                    required
                    maxLength={field === "label" ? 200 : 1000}
                    value={pair[field]}
                    lang={contentLanguage}
                    onChange={(e) => {
                      changeDraft({
                        pairs: pairs.map((p) =>
                          p.key === pair.key ? { ...p, [field]: e.target.value } : p,
                        ),
                      });
                      clear(id);
                    }}
                  />
                  {message(id)}
                </div>
              );
            })}
            <IconTooltip label={labels.removeCharacteristic}>
              <button
                type="button"
                className={cn(productButtonClass, destructiveActionClass)}
                aria-label={labels.removeCharacteristic}
                onClick={() => changeDraft({ pairs: pairs.filter((p) => p.key !== pair.key) })}
              >
                <Trash2Icon aria-hidden="true" />
              </button>
            </IconTooltip>
          </div>
        ))}
        <button
          type="button"
          className={productButtonClass}
          disabled={pairs.length >= 100}
          onClick={() =>
            changeDraft({ pairs: [...pairs, { key: nextKey.current++, label: "", value: "" }] })
          }
        >
          <PlusIcon />
          {labels.addCharacteristic}
        </button>
      </fieldset>
    </div>
  );
  return (
    <section className={cn("mx-auto max-w-2xl space-y-4", className)}>
      <BackLink href={backHref} linkComponent={linkComponent}>
        {labels.back}
      </BackLink>
      <h1 className="text-2xl font-semibold">
        {base || loading ? labels.editProduct : labels.add}
      </h1>
      {loading && <LoadingBadge label={labels.loading} />}
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        onKeyDownCapture={submitFormOnShortcut}
        className="@container space-y-5"
      >
        <fieldset disabled={action.pending || loading || uploading} className="min-w-0 space-y-4">
          {locales.length > 1 ? (
            <Tabs.Root value={language} onValueChange={(value: string) => setLanguage(value)}>
              <Tabs.List
                aria-label={labels.language}
                className="flex gap-1 overflow-x-auto border-b border-border"
              >
                {locales.map(({ code, name }) => (
                  <Tabs.Tab
                    key={code}
                    type="button"
                    value={code}
                    lang={code}
                    disabled={loading || action.pending}
                    className={languageTabClass}
                  >
                    {name}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              <Tabs.Panel key={language} value={language} className="pt-4">
                {contentFields}
              </Tabs.Panel>
            </Tabs.Root>
          ) : (
            contentFields
          )}
          <div className={labelClass}>
            <label htmlFor={priceId}>
              {labels.price} ({currency})
            </label>
            <input
              {...fieldProps(priceId)}
              className={inputClass}
              inputMode="decimal"
              maxLength={24}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                clear(priceId);
              }}
            />
            {message(priceId)}
          </div>
          {categories && categories.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="font-medium">{labels.categories}</legend>
              <ProductCategoryTree
                categories={categories}
                render={(category) => (
                  <label className="flex min-h-9 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setCategoryIds(
                            productCategorySelection([...categoryIds, category.id], categories),
                          );
                        else {
                          const removed = new Set([
                            category.id,
                            ...categories
                              .filter((c) => c.parentId === category.id)
                              .map((c) => c.id),
                          ]);
                          setCategoryIds(categoryIds.filter((id) => !removed.has(id)));
                        }
                      }}
                    />
                    {productCategoryName(category, language)}
                  </label>
                )}
              />
            </fieldset>
          )}
          <ProductMediaFields
            media={media}
            onChange={setMedia}
            onUploading={setUploading}
            {...{ uploadImage, imageUrl, labels, prefix, inputClass, validation }}
          />
        </fieldset>
        <div className={editorActionsClass}>
          {Boolean(action.error) && (
            <p role="alert" className="text-sm text-destructive">
              {errorCode === "SLUG_TAKEN"
                ? labels.slugTaken
                : errorCode === "CONFLICT"
                  ? labels.conflict
                  : labels.saveError}
            </p>
          )}
          <button
            type="submit"
            disabled={action.pending || loading || uploading}
            className={cn(productPrimaryClass, "ml-auto")}
          >
            <SaveIcon />
            {labels.save}
          </button>
        </div>
      </form>
    </section>
  );
}
