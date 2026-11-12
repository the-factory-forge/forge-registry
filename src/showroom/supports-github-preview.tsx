import { useEffect, useState } from "react";

import {
  SupportGithubCard,
  type SupportsGithubClient,
  type SupportsGithubConnection,
} from "@/components/connectors/supports-github";
import {
  SupportDetailPage,
  type SupportsClient,
  type SupportDetail,
  type SupportActivity,
} from "@/components/plugins/supports";
import { buttonClass } from "@/components/plugins/supports/ui";
import { ShowroomLink } from "@/showroom/routing";
import { ShowroomPreview, previewDataNotice } from "@/showroom/showroom-preview";
import { createSupportsMock } from "@/showroom/supports-mock";

function createDemo() {
  const mock = createSupportsMock();
  let connection: SupportsGithubConnection = {
    state: "unlinked",
    issueUrl: null,
    failure: null,
    pending: 0,
    canRetry: false,
  };
  const remote: string[] = [];
  const imported: SupportActivity[] = [];
  const pending: string[] = [];
  let readOnly = false;
  let fail = false;
  function queue(value: string) {
    pending.push(value);
    connection = {
      ...connection,
      state: "pending",
      failure: null,
      pending: pending.length,
      canRetry: false,
    };
  }
  const github: SupportsGithubClient = {
    async get() {
      return { ...connection };
    },
    async exportTicket(id) {
      if (readOnly || fail) throw new Error("Preview failure");
      if (connection.state !== "unlinked") return;
      const detail = await mock.client.get(id);
      queue(`${detail.ticket.author.name}: ${detail.ticket.description}`);
      detail.activity.forEach((entry) => queue(`${entry.author.name}: ${entry.body}`));
    },
    async retry() {
      if (readOnly || connection.state !== "failed") throw new Error("Unavailable");
      connection = { ...connection, state: "pending", failure: null, canRetry: false };
    },
  };
  const client: SupportsClient = {
    ...mock.client,
    async get(id, cursor) {
      const detail = await mock.client.get(id, cursor);
      return { ...detail, activity: [...detail.activity, ...imported] };
    },
    async comment(input) {
      if (readOnly) throw new Error("Read only");
      await mock.client.comment(input);
      if (connection.state !== "unlinked")
        queue(
          `Alex Morgan: ${input.body}${input.attachmentIds.length ? " — Images were not copied. View originals in Supports." : ""}`,
        );
    },
    async setStatus(id, status) {
      if (readOnly) throw new Error("Read only");
      await mock.client.setStatus(id, status);
      if (connection.state !== "unlinked") queue(`Status: ${status}`);
    },
  };
  return {
    client,
    github,
    remote,
    dispose: mock.dispose,
    configure(values: { readOnly: boolean; fail: boolean }) {
      readOnly = values.readOnly;
      fail = values.fail;
    },
    async newTicket() {
      const ticket = await mock.client.create({
        requestId: crypto.randomUUID(),
        title: "New website request",
        description: "Please review the contact page.",
        type: "support",
        attachmentIds: [],
      });
      imported.length = 0;
      remote.length = 0;
      pending.length = 0;
      connection = { ...connection, issueUrl: null };
      queue(`Alex Morgan: ${ticket.description}`);
      return ticket.id;
    },
    deliver() {
      if (connection.state === "unlinked" || connection.state === "blocked") return;
      if (fail) {
        connection = { ...connection, state: "failed", failure: "DELIVERY", canRetry: true };
        return;
      }
      remote.push(...pending.splice(0));
      connection = {
        state: "synchronized",
        issueUrl: "https://github.com/example/website/issues/42",
        failure: null,
        pending: 0,
        canRetry: false,
      };
    },
    reply() {
      if (!connection.issueUrl) return;
      const body =
        "@alex I reproduced this. [screenshot.png — image not copied](https://github.com/example/website/issues/42#issuecomment-1)";
      imported.push({
        id: crypto.randomUUID(),
        kind: "comment",
        body,
        status: null,
        author: { id: "github:70", name: "maintainer" },
        createdAt: new Date().toISOString(),
        attachments: [],
      });
      remote.push("maintainer: @alex I reproduced this. screenshot.png (original on GitHub)");
    },
    async close(id: string) {
      if (connection.issueUrl) await mock.client.setStatus(id, "closed");
    },
    block() {
      if (connection.state !== "unlinked")
        connection = { ...connection, state: "blocked", failure: "UNCERTAIN", canRetry: false };
    },
    recover() {
      if (connection.state === "blocked") {
        connection = { ...connection, state: "pending", failure: null };
        this.deliver();
      }
    },
  };
}

export function SupportsGithubPreview() {
  const [demo] = useState(createDemo);
  const [id, setId] = useState("sample-1");
  const [detail, setDetail] = useState<SupportDetail>();
  const [revision, refresh] = useState(0);
  const [fail, setFail] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  demo.configure({ fail, readOnly });
  useEffect(() => {
    let active = true;
    void demo.client.get(id).then((value) => {
      if (active) setDetail(value);
    });
    return () => {
      active = false;
    };
  }, [demo, id, revision]);
  useEffect(() => () => demo.dispose(), [demo]);
  const changed = () => refresh((value) => value + 1);
  const action = (run: () => void | Promise<void>) => () => {
    void Promise.resolve(run()).then(changed);
  };
  return (
    <ShowroomPreview
      notice={previewDataNotice}
      controls={
        <div className="space-y-4">
          <p>
            Delivery is paused until you run the worker. The initial ticket represents an existing
            discussion.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Simulate GitHub failure
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
            />
            Read-only connection
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={buttonClass}
              onClick={action(async () => setId(await demo.newTicket()))}
            >
              Create new sample ticket
            </button>
            <button className={buttonClass} onClick={action(() => demo.deliver())}>
              Run delivery worker
            </button>
            <button className={buttonClass} onClick={action(() => demo.reply())}>
              Receive GitHub reply with image
            </button>
            <button className={buttonClass} onClick={action(() => demo.close(id))}>
              Close on GitHub
            </button>
            <button className={buttonClass} onClick={action(() => demo.block())}>
              Simulate uncertain write
            </button>
            <button className={buttonClass} onClick={action(() => demo.recover())}>
              Simulate operator recovery
            </button>
          </div>
          <details>
            <summary className="cursor-pointer font-medium">Adapters and installation</summary>
            <div className="mt-3 space-y-3">
              <p>
                Install @forge/supports-github and @forge/supports-github-server. The host supplies
                a private repository, GitHub App credentials, staff authorization, database
                migrations, raw-body webhook routes and scheduled workers.
              </p>
              <a
                className="underline"
                href="https://github.com/the-factory-forge/forge-registry/blob/main/docs/supports-github.md"
              >
                Host setup guide
              </a>
            </div>
          </details>
        </div>
      }
    >
      {detail?.ticket.id === id && (
        <SupportDetailPage
          client={demo.client}
          ticket={detail.ticket}
          activity={detail.activity}
          backHref="/?category=Connector"
          linkComponent={ShowroomLink}
          onChanged={changed}
          integrationContent={
            <SupportGithubCard
              ticketId={id}
              client={demo.github}
              revision={revision}
              onChanged={changed}
              canWrite={!readOnly}
            />
          }
        />
      )}
      <section
        className="mt-8 space-y-3 rounded-lg border border-border p-4"
        aria-label="Mock GitHub discussion"
      >
        <h2 className="font-semibold">Mock GitHub discussion</h2>
        {demo.remote.length ? (
          demo.remote.map((body, index) => (
            <p key={index} className="text-sm break-words whitespace-pre-wrap">
              {body}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No delivery yet.</p>
        )}
      </section>
    </ShowroomPreview>
  );
}
