"use client";

import { CalendarDaysIcon, PencilIcon } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";

import { inputClass } from "@/components/plugins/customers/ui";
import { cn } from "@/components/utils/cn";

export function InlineOfferField({
  label,
  value,
  display = value,
  onChange,
  type = "text",
  maxLength,
  min,
  indicator = false,
  startEditing = false,
  contentEditable = false,
}: {
  label: string;
  value: string;
  display?: string;
  onChange?: (value: string) => void;
  type?: "text" | "date" | "decimal" | "textarea";
  maxLength?: number;
  min?: string;
  indicator?: boolean;
  startEditing?: boolean;
  contentEditable?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const original = useRef(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const focus = useCallback((element: HTMLInputElement | HTMLTextAreaElement | null) => {
    input.current = element;
    element?.focus();
  }, []);

  const focusEditable = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    // Let the browser own the text and caret for the duration of the edit.
    element.textContent = original.current;
    element.focus();
    element.ownerDocument.getSelection()?.collapse(element, element.childNodes.length);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Escape" && (event.key !== "Enter" || type === "textarea")) return;
    event.preventDefault();
    flushSync(() => {
      if (event.key === "Escape") onChange?.(original.current);
      setEditing(false);
    });
    trigger.current?.focus();
  }

  function updateEditable(element: HTMLDivElement) {
    const text = element.innerText;
    const normalized = type === "textarea" ? text : text.replace(/[\r\n]/g, "");
    const next = maxLength !== undefined && normalized.length > maxLength ? value : normalized;
    if (next !== text) {
      element.textContent = next;
      element.ownerDocument.getSelection()?.collapse(element, element.childNodes.length);
    }
    onChange?.(next);
  }

  if (!onChange) return <span className="wrap-anywhere whitespace-pre-wrap">{display}</span>;
  const Icon = type === "date" ? CalendarDaysIcon : PencilIcon;
  if (editing && contentEditable) {
    return (
      <div
        ref={focusEditable}
        tabIndex={0}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Name the contenteditable field as a textbox.
        role="textbox"
        aria-label={label}
        aria-multiline={type === "textarea" || undefined}
        contentEditable="plaintext-only"
        inputMode={type === "decimal" ? "decimal" : undefined}
        spellCheck={type === "decimal" ? false : undefined}
        className={cn(
          inputClass,
          "h-auto min-h-8 min-w-0 px-2 py-1 text-start wrap-anywhere whitespace-pre-wrap",
        )}
        onInput={(event) => {
          if (!(event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing)) {
            updateEditable(event.currentTarget);
          }
        }}
        onCompositionEnd={(event) => updateEditable(event.currentTarget)}
        onKeyDown={onKeyDown}
        onBlur={() => setEditing(false)}
      />
    );
  }
  if (editing) {
    const props = {
      ref: focus,
      value,
      "aria-label": label,
      maxLength,
      onKeyDown,
      onBlur: () => setEditing(false),
    };
    return type === "textarea" ? (
      <textarea
        {...props}
        rows={1}
        className={cn(inputClass, "field-sizing-content min-h-8 min-w-24 py-1")}
        onChange={(event) => onChange(event.target.value)}
      />
    ) : (
      <input
        {...props}
        type={type === "date" ? "date" : "text"}
        min={min}
        inputMode={type === "decimal" ? "decimal" : undefined}
        className={cn(inputClass, "h-8 px-2 text-inherit", type === "date" ? "w-auto" : "min-w-16")}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <button
      ref={trigger}
      type="button"
      aria-label={display && display !== label ? label + ": " + display : label}
      className="group/field inline-flex max-w-full cursor-pointer items-center gap-2 rounded-sm text-start hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={() => {
        original.current = value;
        if (type !== "date") {
          setEditing(true);
          return;
        }
        flushSync(() => setEditing(true));
        try {
          if (input.current instanceof HTMLInputElement) input.current.showPicker?.();
        } catch {
          // The focused date input still supports typing and its native picker.
        }
      }}
    >
      <span className="wrap-anywhere whitespace-pre-wrap">{display || label}</span>
      {indicator && (
        <Icon
          aria-hidden="true"
          className="size-4 shrink-0 group-hover/field:opacity-100 group-focus-visible/field:opacity-100 print:hidden [@media(hover:hover)]:opacity-0"
        />
      )}
    </button>
  );
}
