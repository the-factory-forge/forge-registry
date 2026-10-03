"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { SearchIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/components/utils/cn";

export { matchesTableSearch } from "@/components/utils/table-search";

export interface TableSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  clearLabel?: string;
  alwaysExpanded?: boolean;
  maxLength?: number;
  className?: string;
}

const iconButtonClass =
  "absolute top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg bg-transparent text-muted-foreground outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none [&_svg]:size-4";

export function TableSearch({
  value,
  onValueChange,
  label = "Search table",
  placeholder = `${label}…`,
  clearLabel = `Clear ${label.toLowerCase()}`,
  alwaysExpanded = false,
  maxLength,
  className,
}: TableSearchProps) {
  const id = `factory-table-search-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const expanded = alwaysExpanded || focused || value.length > 0;

  return (
    <div
      className={cn(
        "relative h-8 max-w-full shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-xs transition-[width,border-color,box-shadow] duration-200 focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/15 hover:border-input motion-reduce:transition-none",
        expanded ? "w-56" : "w-8",
        className,
      )}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Button
        type="button"
        className={cn(iconButtonClass, "left-0.5 z-10", expanded && "text-primary")}
        aria-label={label}
        aria-controls={id}
        aria-expanded={expanded}
        tabIndex={expanded ? -1 : 0}
        onFocus={() => inputRef.current?.focus()}
        onClick={() => inputRef.current?.focus()}
      >
        <SearchIcon aria-hidden="true" />
      </Button>
      <Input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onValueChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-hidden={!expanded}
        tabIndex={expanded ? 0 : -1}
        maxLength={maxLength}
        className={cn(
          "h-full w-full min-w-0 appearance-none border-0 bg-transparent py-1 pr-8 pl-9 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:appearance-none",
          !expanded && "pointer-events-none opacity-0",
        )}
      />
      {value && (
        <Button
          type="button"
          className={cn(iconButtonClass, "right-0.5 size-6 bg-foreground/5 [&_svg]:size-3.5")}
          aria-label={clearLabel}
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
        >
          <XIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
