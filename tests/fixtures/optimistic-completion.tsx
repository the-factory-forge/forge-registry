import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { useCustomerAction } from "@/components/plugins/customers/ui";
import { EmployeeCreateDialog } from "@/components/plugins/employees/employee-create-dialog";
import { ReservationsCalendar } from "@/components/plugins/reservations/admin";
import { useReservationLoad } from "@/components/plugins/reservations/ui";
import { useOptimisticAction } from "@/components/utils/use-optimistic-action";
import { createReservationsMock } from "@/showroom/reservations-mock";

import "../../src/styles/globals.css";

type Call = { kind: string; resolve: () => Promise<void>; reject: () => void };
const calls: Call[] = [];
const accepted: string[] = [];
function hold<T>(kind: string, write: () => Promise<T>) {
  return new Promise<T>((resolve, reject) =>
    calls.push({
      kind,
      resolve: async () => {
        await write().then(resolve, reject);
      },
      reject: () => reject(new Error("Rejected")),
    }),
  );
}
const store = createReservationsMock();
store.populateList();
let reads = 0;
const makeClient = () => ({
  ...store.adminClient,
  listPage: async (query: Parameters<typeof store.adminClient.listPage>[0]) => {
    reads++;
    return store.adminClient.listPage(query);
  },
  setStatus: (...args: Parameters<typeof store.adminClient.setStatus>) =>
    hold("status", () => store.adminClient.setStatus(...args)),
  reschedule: (...args: Parameters<typeof store.adminClient.reschedule>) =>
    hold("move", () => store.adminClient.reschedule(...args)),
});
const clients = [makeClient(), makeClient()];
const mode = new URLSearchParams(location.search).get("mode");
declare global {
  interface Window {
    completionTest: {
      calls: Call[];
      accepted: string[];
      reads: () => number;
      date: string;
      replace: () => void;
      unmount: () => void;
      updateHost: () => void;
    };
  }
}
let updateHost = () => {};
function Demo({ owner }: { owner: number }) {
  const [data, setData] = useState({ name: "Original", note: "Initial" });
  const optimistic = useOptimisticAction(data, owner);
  const command = useCustomerAction("Save failed", owner);
  useEffect(() => {
    updateHost = () => setData((value) => ({ ...value, note: "Fresh host data" }));
  }, []);
  return (
    <>
      <output aria-label="Name">{optimistic.value.name}</output>
      <output aria-label="Note">{optimistic.value.note}</output>
      <button
        disabled={optimistic.pending}
        onClick={() => {
          void optimistic
            .run(
              (value) => ({ ...value, name: "Preview" }),
              () => hold("rename", async () => ({ name: "Canonical", note: "Fresh host data" })),
              (saved) => {
                accepted.push("rename");
                setData(saved);
              },
            )
            .catch(() => {});
        }}
      >
        Rename
      </button>
      {optimistic.error && <p role="alert">Rename failed</p>}
      <button
        disabled={command.pending}
        onClick={() => {
          void command.run(
            () => hold("command", async () => {}),
            "Saved",
            () => accepted.push("command"),
          );
        }}
      >
        Save command
      </button>
      {command.feedback && <p role="alert">{command.feedback.message}</p>}
    </>
  );
}
function ReadDemo() {
  const load = useCallback(() => hold("read", async () => ({ name: "Read snapshot" })), []);
  const data = useReservationLoad(load);
  return (
    <>
      <output aria-label="Read value">{data.value?.name}</output>
      <button onClick={data.reload}>Refresh read</button>
      <button onClick={() => data.setValue(() => ({ name: "Accepted write" }))}>
        Accept write
      </button>
    </>
  );
}
function Fixture() {
  const [owner, setOwner] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    window.completionTest = {
      calls,
      accepted,
      reads: () => reads,
      date: store.initialDate,
      replace: () => flushSync(() => setOwner((value) => value + 1)),
      unmount: () => flushSync(() => setVisible(false)),
      updateHost: () => updateHost(),
    };
  }, []);
  if (!visible) return null;
  if (mode === "read") return <ReadDemo />;
  if (mode === "reservations")
    return (
      <ReservationsCalendar
        client={clients[owner % 2]}
        newHref="#new"
        initialDate={store.initialDate}
      />
    );
  if (mode === "employee")
    return (
      <EmployeeCreateDialog
        currentUserRole={owner === 0 ? "admin" : "user"}
        onCreate={() => hold("create", async () => ({ invitationSent: true }))}
      />
    );
  return <Demo owner={owner} />;
}
createRoot(document.getElementById("factory-optimistic-fixture")!).render(
  <ActionToastProvider>
    <Fixture />
  </ActionToastProvider>,
);
