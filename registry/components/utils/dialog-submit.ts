import type { KeyboardEvent } from "react";

export function submitDialogOnShortcut(event: KeyboardEvent<HTMLElement>) {
  if (
    event.key !== "Enter" ||
    !(event.metaKey || event.ctrlKey) ||
    event.altKey ||
    event.shiftKey ||
    event.nativeEvent.isComposing ||
    event.defaultPrevented ||
    !event.currentTarget.contains(event.target as Node)
  )
    return;

  const submit = event.currentTarget.querySelector<HTMLButtonElement | HTMLInputElement>(
    'form button[type="submit"], form button:not([type]), form input[type="submit"]',
  );
  if (!submit) return;

  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat && !submit.matches(':disabled, [aria-disabled="true"]')) submit.click();
}
