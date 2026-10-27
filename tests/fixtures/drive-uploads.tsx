import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { ActionToastProvider } from "@/components/action-toast";
import { driveLabels } from "@/components/plugins/drive/labels";
import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import type {
  DriveClient,
  DriveScope,
  DriveUploadInput,
  DriveUploadTicket,
} from "@/components/plugins/drive/types";
import { DriveToasts } from "@/components/plugins/drive/ui";
import { useUploads } from "@/components/plugins/drive/use-uploads";
import { DriveError } from "@/components/plugins/drive/utils";

import "../../src/styles/globals.css";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const preparations: (ReturnType<typeof deferred<DriveUploadTicket>> & {
  input: DriveUploadInput & { relativePath?: string };
})[] = [];
const transfers: (ReturnType<typeof deferred<void>> & {
  id: string;
  signal: AbortSignal;
  progress: (value: number) => void;
})[] = [];
const completions: (ReturnType<typeof deferred<void>> & { id: string })[] = [];
const cancellations: (ReturnType<typeof deferred<void>> & { id: string })[] = [];
let refreshes = 0;
const refresh = () => {
  refreshes++;
};
const unused = async (): Promise<never> => {
  throw new Error("Unused operation");
};
const prepare = (input: DriveUploadInput & { relativePath?: string }) => {
  const request = { ...deferred<DriveUploadTicket>(), input };
  preparations.push(request);
  return request.promise;
};
const client: DriveClient = {
  listSpaces: unused,
  listEntries: unused,
  createFolder: unused,
  rename: unused,
  previewDelete: unused,
  deleteEntry: unused,
  getDownload: unused,
  prepareUpload: prepare,
  prepareFolderUpload: prepare,
  completeUpload: ({ uploadId }) => {
    const request = { ...deferred<void>(), id: uploadId };
    completions.push(request);
    return request.promise;
  },
  cancelUpload: ({ uploadId }) => {
    const request = { ...deferred<void>(), id: uploadId };
    cancellations.push(request);
    return request.promise;
  },
};
const transfer: DriveTransfer = (ticket, _file, { signal, onProgress }) => {
  const request = { ...deferred<void>(), id: ticket.id, signal, progress: onProgress };
  transfers.push(request);
  signal.addEventListener(
    "abort",
    () => request.reject(new DOMException("Aborted", "AbortError")),
    { once: true },
  );
  return request.promise;
};
const scope: DriveScope = { type: "project", id: "uploads" };
const controls = {
  preparations,
  transfers,
  completions,
  cancellations,
  prepare: (index: number, completed = false) =>
    preparations[index].resolve({ id: preparations[index].input.requestId, completed }),
  failPreparation: (index: number) => preparations[index].reject(new DriveError("STORAGE")),
  failTransfer: (index: number) => transfers[index].reject(new DriveError("STORAGE")),
  failCancellation: (index: number, missing = false) =>
    cancellations[index].reject(new DriveError(missing ? "NOT_FOUND" : "STORAGE")),
  refreshes: () => refreshes,
  unmount: () => root.unmount(),
};
declare global {
  interface Window {
    uploadTest: typeof controls & { queue: ReturnType<typeof useUploads> };
  }
}
function Fixture() {
  const queue = useUploads(client, scope, null, refresh, transfer);
  useEffect(() => {
    window.uploadTest = { ...controls, queue };
  }, [queue]);
  return <DriveToasts queue={queue} labels={driveLabels} />;
}
const root = createRoot(document.getElementById("factory-drive-uploads-fixture")!);
root.render(
  <ActionToastProvider>
    <Fixture />
  </ActionToastProvider>,
);
