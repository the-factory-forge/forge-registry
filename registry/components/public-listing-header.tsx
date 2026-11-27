"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { submitFormOnShortcut } from "@/components/utils/dialog-submit";

export interface PublicListingHeaderProps {
  title: string;
  search?: {
    label: string;
    value: string;
    categoryId?: string;
    maxLength?: number;
  } & (
    | { actionHref: string; onSearchChange?: never }
    | { actionHref?: never; onSearchChange: (value: string) => void }
  );
}

export function PublicListingHeader({ title, search }: PublicListingHeaderProps) {
  const inputId = `factory-public-search-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const { value, actionHref, categoryId } = search ?? {};

  useEffect(() => {
    if (inputRef.current && value !== undefined && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), [actionHref, categoryId, value]);

  function scheduleSearch(input: HTMLInputElement) {
    clearTimeout(timer.current);
    if (composing.current || input.value === value) return;
    const form = input.form;
    timer.current = setTimeout(() => form?.requestSubmit(), 300);
  }

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center">
      <h1 className="min-w-0 flex-1 font-serif text-4xl font-semibold tracking-tight wrap-anywhere sm:text-5xl">
        {title}
      </h1>
      {search && (
        <form
          onKeyDownCapture={submitFormOnShortcut}
          action={actionHref}
          method="get"
          className="w-full max-w-lg sm:w-1/2 sm:shrink-0"
          onSubmit={(event) => {
            clearTimeout(timer.current);
            if (!search.onSearchChange) return;
            event.preventDefault();
            const next = inputRef.current?.value.trim() ?? "";
            if (next !== value) search.onSearchChange(next);
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            {search.label}
          </label>
          <div className="relative h-11 min-w-0 flex-1 rounded-xl border border-border/70 bg-background transition-[border-color,box-shadow] duration-200 focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/15 hover:border-input motion-reduce:transition-none">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              name="search"
              defaultValue={value}
              maxLength={search.maxLength}
              onChange={(event) => scheduleSearch(event.currentTarget)}
              onCompositionStart={() => {
                composing.current = true;
                clearTimeout(timer.current);
              }}
              onCompositionEnd={(event) => {
                composing.current = false;
                scheduleSearch(event.currentTarget);
              }}
              placeholder={`${search.label}...`}
              className="h-full w-full min-w-0 appearance-none rounded-xl border-0 bg-transparent py-1 pr-3 pl-11 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          {actionHref && categoryId && <input type="hidden" name="category" value={categoryId} />}
        </form>
      )}
    </header>
  );
}
