import { useLocation } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { AgentsWebMcp } from "@/components/connectors/agents-webmcp";
import { createPluginAgentClient, type PreviewOperation } from "@/showroom/plugin-agent-client";

export function PluginWebMcp({
  operations,
  context = {},
  revision = "",
  onChange,
}: {
  operations: PreviewOperation[];
  context?: Record<string, unknown> | (() => Record<string, unknown>);
  revision?: string;
  onChange?: () => void | Promise<void>;
}) {
  const location = useLocation();
  const current = useRef({ operations, context, location });
  useLayoutEffect(() => {
    current.current = { operations, context, location };
  });
  // The factory stores this callback; it reads the ref only when a tool is called.
  // eslint-disable-next-line react-hooks/refs
  const [client] = useState(() => createPluginAgentClient(() => current.current.operations));
  return (
    <AgentsWebMcp
      client={client}
      contextKey={`${location.pathname}:${location.searchStr}:${revision}`}
      getContext={() => ({
        sampleData: true,
        path: current.current.location.pathname,
        ...(typeof current.current.context === "function"
          ? current.current.context()
          : current.current.context),
      })}
      onChange={() => {
        let refreshed: void | Promise<void>;
        flushSync(() => {
          refreshed = onChange?.();
        });
        return refreshed!;
      }}
    />
  );
}
