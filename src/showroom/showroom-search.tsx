"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";
import { examples } from "@/showroom/examples";
import { ShowroomLink } from "@/showroom/routing";

const iconButtonClass =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function ShowroomSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = words.length
    ? examples.filter((example) => {
        const text = [
          example.title,
          example.category,
          example.description,
          ...(example.tags ?? []),
          ...example.keywords,
        ]
          .join(" ")
          .toLowerCase();
        return words.every((word) => text.includes(word));
      })
    : [];

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.altKey &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        if (!event.repeat) {
          setOpen(true);
          inputRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function focusResult(index: number) {
    const link = resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a")[index];
    (link ?? inputRef.current)?.focus();
    link?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <IconTooltip label="Search registry (⌘K / Ctrl+K)">
        <Dialog.Trigger
          aria-label="Search registry"
          aria-keyshortcuts="Meta+K Control+K"
          className="inline-flex h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <SearchIcon className="size-5 shrink-0" aria-hidden="true" />
          <kbd
            aria-hidden="true"
            className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground lg:block"
          >
            ⌘ / Ctrl K
          </kbd>
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed top-[10dvh] left-1/2 z-50 flex h-[min(32rem,80dvh)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground outline-none"
        >
          <Dialog.Title className="sr-only">Search registry</Dialog.Title>
          <Dialog.Description className="sr-only">
            Find components, page sections, layouts, and plugins. Use the arrow keys to navigate
            results and Enter to open.
          </Dialog.Description>
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3 sm:px-5">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              aria-label="Search registry examples"
              aria-controls="factory-showroom-search-results"
              placeholder="Search registry…"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  focusResult(event.key === "ArrowDown" ? 0 : results.length - 1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  resultsRef.current?.querySelector<HTMLAnchorElement>("a")?.click();
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-1 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-search-cancel-button]:hidden"
            />
            <IconTooltip label="Clear search">
              <button
                type="button"
                aria-label="Clear search"
                className={cn(iconButtonClass, !query && "invisible")}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </IconTooltip>
            <IconTooltip label="Close search">
              <Dialog.Close aria-label="Close search" className={iconButtonClass}>
                <XIcon className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </IconTooltip>
          </div>
          <div className="min-h-0 flex-1 [scrollbar-color:var(--border)_transparent] overflow-y-auto overscroll-contain p-3 sm:p-5">
            <output aria-atomic="true" className="block min-h-5 text-xs text-muted-foreground">
              {words.length > 0 &&
                `${results.length} ${results.length === 1 ? "result" : "results"}`}
            </output>
            {!words.length ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center">
                <SearchIcon className="mb-1 size-8 text-primary" aria-hidden="true" />
                <p className="font-semibold">Search the registry</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Find components, page sections, layouts, and plugins.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="max-w-full font-semibold break-words">
                  No results for “{query.trim()}”
                </p>
                <p className="text-sm text-muted-foreground">
                  Try a component name or a different keyword.
                </p>
              </div>
            ) : null}
            <ul
              id="factory-showroom-search-results"
              ref={resultsRef}
              aria-label="Search results"
              className="mt-2 space-y-1"
            >
              {results.map((result, index) => (
                <li key={result.href}>
                  <ShowroomLink
                    href={result.href}
                    onClick={() => changeOpen(false)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        focusResult(index + (event.key === "ArrowDown" ? 1 : -1));
                      }
                    }}
                    className="block rounded-lg p-3 hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="block text-xs text-muted-foreground">{result.category}</span>
                    <span className="mt-1 block font-semibold">{result.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {result.description}
                    </span>
                  </ShowroomLink>
                </li>
              ))}
            </ul>
          </div>
          <footer
            aria-hidden="true"
            className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6"
          >
            <span className="flex items-center gap-1">
              <CornerDownLeftIcon className="size-4" /> to open
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownIcon className="size-4" />
              <ArrowUpIcon className="size-4" /> to navigate
            </span>
            <span>
              <kbd className="rounded border border-border px-1 py-0.5">esc</kbd> to close
            </span>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
