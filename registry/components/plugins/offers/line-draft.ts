"use client";

import { useRef, useState, type HTMLAttributes, type PointerEvent } from "react";

import type { OfferLine } from "@/components/plugins/offers/model";

export function editLine(line: OfferLine, digits: number, key: string) {
  return {
    key,
    description: line.description,
    unit: line.unit,
    quantityMilli: String(line.quantityMilli / 1000),
    priceMinor: (line.priceMinor / 10 ** digits).toFixed(digits),
    discountBps: String(line.discountBps / 100),
    taxBps: String(line.taxBps / 100),
  };
}
function scaled(value: string, digits: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) return NaN;
  const [whole, frac = ""] = value.split(".");
  if (frac.length > digits) return NaN;
  return Number(whole + frac.padEnd(digits, "0"));
}
export function readLine(line: ReturnType<typeof editLine>, digits: number): OfferLine {
  return {
    description: line.description,
    unit: line.unit,
    quantityMilli: scaled(line.quantityMilli, 3),
    priceMinor: scaled(line.priceMinor, digits),
    discountBps: scaled(line.discountBps, 2),
    taxBps: scaled(line.taxBps, 2),
  };
}

export type OfferLineDraft = ReturnType<typeof editLine>;

export type OfferLineControls = {
  handle: HTMLAttributes<HTMLButtonElement>;
  moveUp: (() => void) | undefined;
  moveDown: (() => void) | undefined;
};

export function useOfferLineOrder(
  lines: OfferLineDraft[],
  update: (change: (lines: OfferLineDraft[]) => OfferLineDraft[]) => void,
  pending: boolean,
) {
  const drag = useRef<{ key: string; pointerId: number; startY: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    source: string;
    key: string;
    after: boolean;
  } | null>(null);
  function move(key: string, target: string, after: boolean) {
    update((current) => {
      const line = current.find((line) => line.key === key);
      if (!line || target === key) return current;
      const next = current.filter((line) => line.key !== key);
      const index = next.findIndex((line) => line.key === target);
      if (index < 0) return current;
      next.splice(index + Number(after), 0, line);
      return next;
    });
  }
  function cancelDrag() {
    drag.current = null;
    setDropTarget(null);
  }
  function getDropTarget(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (
      pending ||
      !active ||
      active.pointerId !== event.pointerId ||
      Math.abs(event.clientY - active.startY) < 5
    )
      return null;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLTableRowElement>("tr");
    if (!row || row.parentElement !== event.currentTarget.closest("tbody")) return null;
    const target = lines[row.sectionRowIndex];
    if (!target || target.key === active.key) return null;
    const { top, height } = row.getBoundingClientRect();
    return { source: active.key, key: target.key, after: event.clientY > top + height / 2 };
  }

  return {
    rowClass(key: string) {
      if (dropTarget?.source === key) return "opacity-50";
      if (dropTarget?.key !== key) return undefined;
      return dropTarget.after
        ? "[&>*]:shadow-[inset_0_-2px_0_var(--primary)]"
        : "[&>*]:shadow-[inset_0_2px_0_var(--primary)]";
    },
    controls(key: string, i: number): OfferLineControls {
      const previous = lines[i - 1];
      const next = lines[i + 1];
      const moveUp = !pending && previous ? () => move(key, previous.key, false) : undefined;
      const moveDown = !pending && next ? () => move(key, next.key, true) : undefined;
      const handle: OfferLineControls["handle"] = {
        onPointerDown: (event) => {
          if (event.button !== 0 || !event.isPrimary || pending) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            key: key,
            pointerId: event.pointerId,
            startY: event.clientY,
          };
        },
        onPointerMove: (event) => {
          if (drag.current?.pointerId === event.pointerId) {
            const target = getDropTarget(event);
            if (target?.key !== dropTarget?.key || target?.after !== dropTarget?.after)
              setDropTarget(target);
          }
        },
        onPointerUp: (event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          const target = getDropTarget(event);
          cancelDrag();
          if (target) move(key, target.key, target.after);
        },
        onPointerCancel: cancelDrag,
        onLostPointerCapture: cancelDrag,
        onKeyDown: (event) => {
          if (event.key === "Escape" && drag.current) {
            const { pointerId } = drag.current;
            cancelDrag();
            if (event.currentTarget.hasPointerCapture(pointerId))
              event.currentTarget.releasePointerCapture(pointerId);
          }
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          if (event.key === "ArrowUp") moveUp?.();
          else moveDown?.();
        },
      };
      return { handle, moveUp, moveDown };
    },
  };
}
