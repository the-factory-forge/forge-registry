import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import { DriveBrowser } from "@/components/plugins/drive";
import type { DriveBrowserView } from "@/components/plugins/drive/types";
import { createDriveMock } from "@/showroom/drive-mock";

const scope = { type: "project", id: "portal" };
const client = createDriveMock().client(
  [
    {
      scope,
      name: "Context fixture",
      capabilities: {
        upload: true,
        createFolder: true,
        rename: true,
        delete: true,
        download: true,
      },
    },
  ],
  false,
  "ready",
);

function Fixture() {
  const [view, setView] = useState<DriveBrowserView>();
  const [revision, setRevision] = useState(0);
  const [visible, setVisible] = useState(true);
  return (
    <section data-testid="drive-context-fixture">
      <button
        type="button"
        onClick={async () => {
          await client.createFolder({ scope, parentId: null, name: "External folder" });
          setRevision((value) => value + 1);
        }}
      >
        External folder
      </button>
      <button type="button" onClick={() => setVisible(false)}>
        Unmount Drive
      </button>
      <pre data-testid="observed-view">{JSON.stringify(view ?? null)}</pre>
      {visible && (
        <DriveBrowser
          client={client}
          scope={scope}
          locale="en"
          getFolderHref={(id) => `/?folder=${id ?? ""}`}
          onViewChange={setView}
          refreshVersion={revision}
        />
      )}
    </section>
  );
}

export function mountDriveContextFixture() {
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
}
