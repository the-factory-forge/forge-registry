import type { DriveUploadTicket } from "@/components/plugins/drive/types";
import { DriveError } from "@/components/plugins/drive/utils";

export type DriveTransfer = (
  ticket: DriveUploadTicket,
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void },
) => Promise<void>;

/** Direct browser PUT. The storage URL must permit the host origin through CORS. */
export const transferDriveUpload: DriveTransfer = (ticket, file, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    if (!ticket.url || signal.aborted) {
      reject(new DriveError("STORAGE"));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open("PUT", ticket.url);
    for (const [name, value] of Object.entries(ticket.headers ?? {}))
      xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    // A retry may find an already uploaded staging object. Completion verifies it.
    xhr.onload = () =>
      finish(
        (xhr.status >= 200 && xhr.status < 300) || xhr.status === 412
          ? undefined
          : new DriveError("STORAGE"),
      );
    xhr.onerror = () => finish(new DriveError("STORAGE"));
    xhr.onabort = () => finish(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
