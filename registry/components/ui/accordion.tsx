"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/forge/utils";

type AccordionValue = string;

interface AccordionProps extends Omit<
  AccordionPrimitive.Root.Props,
  "value" | "defaultValue" | "onValueChange" | "multiple"
> {
  type?: "single" | "multiple";
  value?: AccordionValue | AccordionValue[];
  defaultValue?: AccordionValue | AccordionValue[];
  onValueChange?: (value: AccordionValue | AccordionValue[]) => void;
}

function Accordion({
  type = "single",
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: AccordionProps) {
  const multiple = type === "multiple";

  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("w-full", className)}
      multiple={multiple}
      value={value === undefined ? undefined : Array.isArray(value) ? value : [value]}
      defaultValue={
        defaultValue === undefined
          ? undefined
          : Array.isArray(defaultValue)
            ? defaultValue
            : [defaultValue]
      }
      onValueChange={(v) => onValueChange?.(multiple ? v : (v[0] ?? undefined))}
      {...props}
    />
  );
}

function AccordionItem({ className, value, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      value={value}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-panel-open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

// The expand/collapse animation uses height keyframes (see ./accordion.css)
// driven by base-ui's measured --accordion-panel-height variable. Keyframes
// play from a painted start on every open, so the first open animates even
// though closed panels are unmounted (base-ui keeps them mounted during the
// exit animation and unmounts after animationend).
import "./accordion.css";

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm data-closed:animate-[accordion-up_0.2s_ease-out] data-open:animate-[accordion-down_0.2s_ease-out]",
        className,
      )}
      {...props}
    >
      <div className="h-(--accordion-panel-height) pt-0 pb-4">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
