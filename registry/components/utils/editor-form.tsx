"use client";

import { useEffect, useRef, useState } from "react";

export const editorActionsClass =
  "sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]";
export const editorInvalidClass =
  "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive aria-invalid:focus-visible:outline-destructive";

/** Keep field feedback and focus consistent across standalone plugin editors. */
export function useEditorValidation() {
  const formRef = useRef<HTMLFormElement>(null);
  const [issues, setIssues] = useState<Partial<Record<string, string>>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Wait for the editor to reveal an invalid translation before moving focus.
    const frame = requestAnimationFrame(() => {
      const field = Array.from(
        formRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [],
      ).find((element) => element.getClientRects().length > 0);
      field?.scrollIntoView({ block: "center", behavior: "instant" });
      field?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [attempt]);

  function showIssues(next: Partial<Record<string, string>>) {
    setIssues(next);
    setAttempt((previous) => previous + 1);
  }

  function validate(extraIssues: Record<string, string> = {}) {
    const next = { ...extraIssues };
    for (const control of Array.from(formRef.current?.elements ?? [])) {
      if (
        (control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement ||
          control instanceof HTMLSelectElement) &&
        control.willValidate &&
        !control.validity.valid &&
        control.id
      ) {
        next[control.id] ??= control.validationMessage;
      }
    }
    showIssues(next);
    return Object.keys(next).length === 0;
  }

  function clear(key: string) {
    setIssues((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([name]) => name !== key && !name.startsWith(`${key}.`)),
      ),
    );
  }

  function field(id: string) {
    return {
      id,
      "aria-invalid": Boolean(issues[id]),
      "aria-describedby": issues[id] ? `${id}-error` : undefined,
    };
  }

  function message(id: string) {
    return issues[id] ? (
      <span id={`${id}-error`} role="alert" className="block text-sm font-normal text-destructive">
        {issues[id]}
      </span>
    ) : null;
  }

  return { formRef, issues, setIssues: showIssues, validate, clear, field, message };
}
