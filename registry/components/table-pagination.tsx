"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/utils/cn";
import { tableFooterClass } from "@/components/utils/table-styles";

export interface TablePaginationProps {
  summary?: ReactNode;
  /** Current page, including cursor paging when the total is unknown. */
  page?: number;
  /** Omit when the total is unknown. */
  pageCount?: number;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  disabled?: boolean;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}

const buttonClass =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground outline-none transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:size-8";

export function TablePagination({
  summary,
  page,
  pageCount,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  disabled = false,
  label = "Pagination",
  previousLabel = "Previous page",
  nextLabel = "Next page",
  className,
}: TablePaginationProps) {
  return (
    <nav aria-label={label} className={cn(tableFooterClass, className)}>
      {summary != null && (
        <span className="min-w-0 text-sm text-muted-foreground tabular-nums">{summary}</span>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || previousDisabled}
          onClick={onPrevious}
          aria-label={previousLabel}
        >
          <ChevronLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        </button>
        {page != null && (
          <span
            className="min-w-9 text-center text-sm whitespace-nowrap text-muted-foreground tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {pageCount == null ? page : `${page}/${pageCount}`}
          </span>
        )}
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || nextDisabled}
          onClick={onNext}
          aria-label={nextLabel}
        >
          <ChevronRightIcon className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
