import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AgentsPage } from "@/components/plugins/agents";
import { createAgentsMock } from "@/showroom/agents-mock";
import { showroomHead } from "@/showroom/seo";
import { ShowroomPreview } from "@/showroom/showroom-preview";

export const Route = createFileRoute("/$locale/agents")({
  validateSearch: z.object({
    operation: z.string().max(100).optional().catch(undefined),
    conversation: z.uuid().optional().catch(undefined),
    record: z.string().max(100).optional().catch(undefined),
  }),
  head: ({ match }) =>
    showroomHead({
      title: "Agents plugin demo",
      description:
        "Private operation-based chat, saved conversations, file attachments and individual action approvals, with a deterministic mock runtime.",
      path: match.pathname,
    }),
  component: AgentsPreview,
});
function AgentsPreview() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { locale } = Route.useParams();
  const [mock] = useState(() => createAgentsMock(`/${locale}/agents`));
  const [fail, setFail] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  mock.configure({ fail, readOnly });
  return (
    <ShowroomPreview
      controls={
        <div className="space-y-4 text-sm">
          <p>
            This uses a deterministic mock, sample records and browser-session storage. No model or
            live plugin is connected.
          </p>
          <p>
            Try “list” for a read, or enter a new name to review a proposed change. Conversations
            and attachments survive reload in this browser session.
          </p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simulate failure
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
            />
            Read-only tools
          </label>
          <p>
            Production hosts supply the authenticated runtime, PostgreSQL store and private
            attachment storage. Install only the plugin connectors the website needs.
          </p>
        </div>
      }
    >
      {search.record ? (
        <SampleRecord
          key={search.record}
          mock={mock}
          id={search.record}
          onClose={() =>
            void navigate({
              search: (current) => ({ ...current, record: undefined }),
              resetScroll: false,
            })
          }
        />
      ) : (
        <AgentsPage
          client={mock.client}
          operationId={search.operation ?? null}
          conversationId={search.conversation ?? null}
          onSelectionChange={({ operationId, conversationId }) => {
            void navigate({
              search: (current) => ({
                ...current,
                operation: operationId ?? undefined,
                conversation: conversationId ?? undefined,
                record: undefined,
              }),
              resetScroll: false,
            });
          }}
        />
      )}
    </ShowroomPreview>
  );
}

function SampleRecord({
  mock,
  id,
  onClose,
}: {
  mock: ReturnType<typeof createAgentsMock>;
  id: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<Awaited<ReturnType<typeof mock.record>>>();
  useEffect(() => {
    let disposed = false;
    void mock.record(id).then((value) => {
      if (!disposed) setRecord(value);
    });
    return () => {
      disposed = true;
    };
  }, [mock, id]);
  return (
    <section aria-label="Sample record" className="space-y-6">
      <h1 className="text-2xl font-semibold">Sample record</h1>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{record?.operation}</p>
        <p className="text-lg break-words">
          {record === undefined
            ? "Loading…"
            : (record?.name ?? "This sample record is unavailable.")}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="min-h-10 cursor-pointer rounded-md border border-border px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        Back to chat
      </button>
    </section>
  );
}
