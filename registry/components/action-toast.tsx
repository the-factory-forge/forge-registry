"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/components/utils/cn";

const ActionToastContext = createContext<string | null>(null);

export interface ActionToastProviderProps {
  children: ReactNode;
  closeLabel?: string;
}

export interface ActionToastData {
  content?: ReactNode;
  dismissible?: boolean;
  closeLabel?: string;
}

export const actionToastButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors md:min-h-8 text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed data-disabled:cursor-not-allowed";

export interface ActionToastFooterProps {
  status?: ReactNode;
  actions?: ReactNode;
}

export function ActionToastFooter({ status, actions }: ActionToastFooterProps) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2 md:min-h-8">
      <div className="min-w-0 flex-1">{status}</div>
      <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2">{actions}</div>
    </div>
  );
}

export function ActionToastProvider({ children, closeLabel }: ActionToastProviderProps) {
  const inherited = useContext(ActionToastContext);
  const label = closeLabel ?? inherited ?? "Close";
  return (
    <ActionToastContext.Provider value={label}>
      {inherited !== null ? (
        children
      ) : (
        <Toast.Provider limit={Infinity}>
          {children}
          <ActionToastViewport closeLabel={label} />
        </Toast.Provider>
      )}
    </ActionToastContext.Provider>
  );
}

export function useActionToast() {
  const { add } = Toast.useToastManager<ActionToastData>();
  const closeLabel = useContext(ActionToastContext) ?? "Close";
  return (message: string) => add({ title: message, type: "success", data: { closeLabel } });
}

function ActionToastViewport({ closeLabel }: { closeLabel: string }) {
  const { toasts } = Toast.useToastManager<ActionToastData>();
  const totalHeight = toasts.reduce((height, toast) => height + (toast.height ?? 0), 0);
  const expandedHeight = `calc(${totalHeight}px + ${Math.max(0, toasts.length - 1)} * 0.75rem + 2rem)`;
  return (
    <Toast.Portal>
      <Toast.Viewport
        style={({ expanded }) => ({ height: expanded ? expandedHeight : undefined })}
        className="fixed right-0 bottom-0 z-60 flex h-[calc(var(--toast-frontmost-height,0px)+4rem)] max-h-dvh w-full max-w-[26rem] flex-col-reverse p-4 outline-none empty:h-0 empty:p-0 data-expanded:overflow-x-hidden data-expanded:overflow-y-auto sm:right-2 sm:bottom-2 sm:max-h-[calc(100dvh-1rem)]"
      >
        {toasts.map((toast) => {
          const dismissible = toast.data?.dismissible !== false;
          const label = toast.data?.closeLabel ?? closeLabel;
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              aria-busy={toast.type === "loading"}
              swipeDirection={dismissible ? undefined : []}
              onKeyDownCapture={(event) => {
                if (!dismissible && event.key === "Escape") event.stopPropagation();
              }}
              className={cn(
                "absolute inset-x-4 bottom-4 z-[calc(1000-var(--toast-index))] h-(--height) origin-bottom overflow-hidden rounded-xl bg-popover p-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border dark:border-border dark:shadow-none",
                // Match shadcn's Base UI motion while keeping every recovery toast in the queue.
                "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--gap)*-1+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(1-var(--stack-index)*0.1)] [--shrink:calc(1-var(--scale))] [--stack-index:min(var(--toast-index),2)]",
                "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-var(--stack-index)*var(--peek)-var(--shrink)*var(--height)))_scale(var(--scale))] motion-safe:[transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
                "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-limited:hidden data-starting-style:[transform:translateY(150%)]",
                "data-ending-style:pointer-events-none [&[data-ending-style]:not([data-swipe-direction])]:[transform:translateY(150%)]",
                "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
              )}
            >
              <Toast.Content className="flex flex-col gap-3 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100 motion-safe:transition-opacity motion-safe:duration-250 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]">
                <div className="flex items-center gap-3">
                  {toast.type === "loading" ? (
                    <LoaderCircleIcon
                      className="size-5 shrink-0 text-status-pending-foreground motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                  ) : toast.type === "success" ? (
                    <CircleCheckIcon
                      className="size-5 shrink-0 text-status-success-foreground"
                      aria-hidden="true"
                    />
                  ) : toast.type === "error" ? (
                    <CircleAlertIcon
                      className="size-5 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                  ) : (
                    <InfoIcon
                      className="size-5 shrink-0 text-status-info-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <Toast.Title className="min-w-0 flex-1 text-sm break-words" />
                  {dismissible && (
                    <IconTooltip label={label}>
                      <Toast.Close
                        aria-label={label}
                        aria-hidden={false}
                        className={cn(actionToastButtonClass, "size-10 shrink-0 p-0 md:size-8")}
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </Toast.Close>
                    </IconTooltip>
                  )}
                </div>
                {toast.data?.content}
                {(toast.description || toast.actionProps) && (
                  <div className="ms-8">
                    <ActionToastFooter
                      status={
                        <Toast.Description
                          className={cn(
                            "text-sm break-words",
                            toast.type === "error" ? "text-destructive" : "text-muted-foreground",
                          )}
                        />
                      }
                      actions={
                        <Toast.Action
                          className={actionToastButtonClass}
                          disabled={toast.actionProps?.disabled}
                        />
                      }
                    />
                  </div>
                )}
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
