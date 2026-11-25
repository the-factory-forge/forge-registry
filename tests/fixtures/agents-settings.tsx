import { createRoot } from "react-dom/client";

import { AgentsPage, AgentsError, type AgentsSettingsClient } from "@/components/plugins/agents";
import { createAgentsMock } from "@/showroom/agents-mock";

import "../../src/styles/globals.css";

const mode = new URLSearchParams(location.search).get("mode");
const requests: { resolve: () => void; reject: () => void }[] = [];
function pending() {
  return new Promise<void>((resolve, reject) =>
    requests.push({ resolve, reject: () => reject(new AgentsError("NOT_CONFIGURED")) }),
  );
}
const settings: AgentsSettingsClient = {
  async get() {
    if (mode === "unconfigured") throw new AgentsError("NOT_CONFIGURED");
    if (mode === "load-error") throw new AgentsError("RUNTIME");
    return mode === "remove" ? { provider: "deepseek", model: "sample-model" } : null;
  },
  async models() {
    if (mode === "models") await pending();
    if (mode === "models-error") throw new AgentsError("NOT_CONFIGURED");
    return [{ id: "sample-model", label: "Sample model" }];
  },
  save: pending,
  remove: pending,
};
declare global {
  interface Window {
    settingsRequests: typeof requests;
  }
}
window.settingsRequests = requests;
createRoot(document.getElementById("factory-test-root")!).render(
  <AgentsPage
    client={createAgentsMock().client}
    settings={settings}
    connectionSettings={
      new URLSearchParams(location.search).has("tabs") ? (
        <p>Sample external assistant settings</p>
      ) : undefined
    }
    operationId={null}
    conversationId={null}
    onSelectionChange={() => {}}
  />,
);
