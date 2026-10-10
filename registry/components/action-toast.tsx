"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleCheckIcon, XIcon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { IconTooltip } from "@/components/icon-tooltip";

const ActionToastContext = createContext(false);

export interface ActionToastProviderProps {
  children: ReactNode;
  closeLabel?: string;
}

export function ActionToastProvider({ children, closeLabel = "Close" }: ActionToastProviderProps) {
  const inherited = useContext(ActionToastContext);
  if (inherited) return children;
  return (
    <ActionToastContext.Provider value={true}>
      <Toast.Provider>
        {children}
        <ActionToastViewport closeLabel={closeLabel} />
      </Toast.Provider>
    </ActionToastContext.Provider>
  );
}

export function useActionToast() {
  const { add } = Toast.useToastManager();
  return (message: string) => add({ title: message, type: "success" });
}

function ActionToastViewport({ closeLabel }: { closeLabel: string }) {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed top-0 right-0 z-50 flex max-h-dvh w-full max-w-[26rem] flex-col gap-2 overflow-y-auto p-4 outline-none empty:p-0 sm:top-2 sm:right-2 sm:max-h-[calc(100dvh-1rem)]">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="flex items-center gap-3 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring data-ending:opacity-0 data-limited:hidden motion-safe:transition-opacity dark:border dark:border-border dark:shadow-none"
          >
            <CircleCheckIcon
              className="size-5 shrink-0 text-status-success-foreground"
              aria-hidden="true"
            />
            <Toast.Title className="min-w-0 flex-1 text-sm break-words" />
            <IconTooltip label={closeLabel}>
              <Toast.Close
                aria-label={closeLabel}
                aria-hidden={false}
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Toast.Close>
            </IconTooltip>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
