"use client";

import { PlusIcon } from "lucide-react";
import type { ComponentType, ReactNode, Ref, SubmitEvent } from "react";

import { BackLink } from "@/components/back-link";
import type { LinkProps } from "@/components/link";
import { cn } from "@/components/utils/cn";
import { submitFormOnShortcut } from "@/components/utils/dialog-submit";
import { editorInvalidClass } from "@/components/utils/editor-form";
import { buttonClass, primaryClass } from "@/components/utils/table-controls";
import { tablePageClass } from "@/components/utils/table-styles";

const panelClass = "min-w-0 rounded-xl border border-border bg-card p-6 text-card-foreground";
export const categoryInputClass = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive md:text-sm",
  editorInvalidClass,
);

type CategoryManagerItem = {
  id: string;
  parentId?: string | null;
  name: string;
  disabled?: boolean;
};

export interface CategoryManagerProps {
  categories: readonly CategoryManagerItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  title: string;
  backLabel: string;
  backHref: string;
  linkComponent?: ComponentType<LinkProps>;
  onCreate?: () => void;
  createLabel: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  rootRef?: Ref<HTMLElement>;
  feedback?: ReactNode;
  children: ReactNode;
}

export function CategoryManager({
  categories,
  selectedId,
  onSelect,
  title,
  backLabel,
  backHref,
  linkComponent,
  onCreate,
  createLabel,
  emptyLabel,
  disabled,
  className,
  rootRef,
  feedback,
  children,
}: CategoryManagerProps) {
  const childrenByParent = new Map<string, CategoryManagerItem[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  function categoryButton(category: CategoryManagerItem) {
    return (
      <button
        type="button"
        aria-current={selectedId === category.id ? "page" : undefined}
        className={cn(
          buttonClass,
          "w-full min-w-0 justify-start text-start wrap-anywhere whitespace-normal aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary",
          category.parentId ? "font-normal text-muted-foreground" : "font-semibold",
        )}
        disabled={disabled || category.disabled}
        onClick={() => onSelect(category.id)}
      >
        {category.name}
      </button>
    );
  }

  return (
    <section
      ref={rootRef}
      tabIndex={rootRef ? -1 : undefined}
      className={cn(tablePageClass, className)}
    >
      <BackLink href={backHref} linkComponent={linkComponent}>
        {backLabel}
      </BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        {onCreate && (
          <button type="button" className={primaryClass} disabled={disabled} onClick={onCreate}>
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            {createLabel}
          </button>
        )}
      </header>
      {feedback}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label={title} className={cn(panelClass, "self-start")}>
          {categories.length ? (
            <ul className="space-y-2">
              {categories
                .filter((category) => !category.parentId)
                .map((parent) => {
                  const nested = childrenByParent.get(parent.id) ?? [];
                  return (
                    <li key={parent.id}>
                      {categoryButton(parent)}
                      {nested.length > 0 && (
                        <ul
                          className={cn(
                            "ms-3 mt-1 space-y-1 border-s border-border ps-2",
                            nested.some((child) => child.id === selectedId) && "border-primary",
                          )}
                        >
                          {nested.map((child) => (
                            <li key={child.id}>{categoryButton(child)}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          ) : (
            emptyLabel && <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          )}
        </nav>
        {children}
      </div>
    </section>
  );
}

export interface CategoryEditorFormProps {
  title: string;
  actions?: ReactNode;
  disabled?: boolean;
  formRef?: Ref<HTMLFormElement>;
  headingRef?: Ref<HTMLHeadingElement>;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  feedback?: ReactNode;
  children: ReactNode;
}

export function CategoryEditorForm({
  title,
  actions,
  disabled,
  formRef,
  headingRef,
  onSubmit,
  feedback,
  children,
}: CategoryEditorFormProps) {
  return (
    <form
      ref={formRef}
      onKeyDownCapture={submitFormOnShortcut}
      onSubmit={onSubmit}
      className={cn(panelClass, "space-y-5")}
    >
      <header className="flex items-start justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="min-w-0 text-lg font-semibold"
        >
          {title}
        </h2>
        {actions}
      </header>
      <fieldset disabled={disabled} className="space-y-5">
        {children}
      </fieldset>
      {feedback}
    </form>
  );
}

export function CategoryLanguageFields({ name, children }: { name: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
      <legend className="px-2 text-sm font-medium">{name}</legend>
      {children}
    </fieldset>
  );
}
