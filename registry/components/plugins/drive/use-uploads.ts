"use client";

import { useEffect, useRef, useState } from "react";

import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import { transferDriveUpload } from "@/components/plugins/drive/transfer";
import type { DriveClient, DriveScope } from "@/components/plugins/drive/types";
import { DriveError, errorCode } from "@/components/plugins/drive/utils";

type State =
  | "queued"
  | "uploading"
  | "finishing"
  | "done"
  | "failed"
  | "cancelled"
  | "cancelling"
  | "cancelFailed";
interface Job {
  id: string;
  file: File;
  state: State;
  progress: number;
  error?: unknown;
  controller: AbortController;
  reserved: boolean;
  busy: boolean;
  cancelled: boolean;
}
export function useUploads(
  client: DriveClient,
  scope: DriveScope,
  parentId: string | null,
  refresh: () => void,
  transfer: DriveTransfer = transferDriveUpload,
) {
  const jobs = useRef<Job[]>([]);
  const mounted = useRef(true);
  const [uploads, setUploads] = useState<Job[]>([]);
  const publish = () => {
    if (mounted.current) setUploads(jobs.current.map((job) => ({ ...job })));
  };
  async function abandon(job: Job) {
    job.state = "cancelling";
    publish();
    try {
      if (job.reserved) await client.cancelUpload({ scope, uploadId: job.id });
      job.state = "cancelled";
    } catch (error) {
      job.state = errorCode(error) === "NOT_FOUND" ? "cancelled" : "cancelFailed";
      job.error = job.state === "cancelled" ? undefined : error;
    }
    publish();
  }
  async function run(job: Job) {
    job.busy = true;
    job.state = "uploading";
    job.error = undefined;
    publish();
    try {
      // Mark before preparation: a lost preparation response may still reserve a file.
      job.reserved = true;
      const ticket = await client.prepareUpload({
        scope,
        parentId,
        requestId: job.id,
        name: job.file.name,
        size: job.file.size,
        contentType: job.file.type,
      });
      if (job.cancelled) {
        await abandon(job);
        return;
      }
      if (!ticket.completed) {
        try {
          await transfer(ticket, job.file, {
            signal: job.controller.signal,
            onProgress: (value) => {
              job.progress = value;
              publish();
            },
          });
        } catch (error) {
          if (job.cancelled) throw error;
          // A dropped PUT response is uncertain; the server can verify whether it arrived.
          job.state = "finishing";
          publish();
          await client.completeUpload({ scope, uploadId: job.id });
          job.state = "done";
          job.progress = 100;
          if (mounted.current) refresh();
          return;
        }
        if (job.cancelled) {
          await abandon(job);
          return;
        }
        job.state = "finishing";
        publish();
        await client.completeUpload({ scope, uploadId: job.id });
      }
      job.state = "done";
      job.progress = 100;
      if (mounted.current) refresh();
    } catch (error) {
      if (job.cancelled) await abandon(job);
      else {
        job.state = "failed";
        job.error = error;
      }
    } finally {
      job.busy = false;
      publish();
      pump();
    }
  }
  function pump() {
    if (!mounted.current) return;
    let active = jobs.current.filter((job) => job.busy).length;
    for (const job of jobs.current) {
      if (active >= 2) break;
      if (job.state === "queued") {
        active++;
        void run(job);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const job of jobs.current) {
        if (["done", "cancelled"].includes(job.state)) continue;
        job.cancelled = true;
        job.controller.abort();
        if (!job.busy) void abandon(job);
      }
    };
    // This hook is owned by a browser keyed to its space and folder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    uploads,
    add(files: File[], maxBytes: number) {
      for (const file of files)
        jobs.current.push({
          id: crypto.randomUUID(),
          file,
          state: file.size > maxBytes ? "failed" : "queued",
          error: file.size > maxBytes ? new DriveError("INVALID") : undefined,
          progress: 0,
          controller: new AbortController(),
          reserved: false,
          busy: false,
          cancelled: false,
        });
      publish();
      pump();
    },
    cancel(id: string) {
      const job = jobs.current.find((item) => item.id === id);
      if (!job || job.state === "finishing" || job.state === "done") return;
      job.cancelled = true;
      job.controller.abort();
      if (!job.busy) void abandon(job);
      else {
        job.state = "cancelling";
        publish();
      }
    },
    retry(id: string) {
      const job = jobs.current.find((item) => item.id === id);
      if (!job || job.busy) return;
      if (job.state === "cancelFailed") {
        void abandon(job);
        return;
      }
      if (job.state !== "failed") return;
      job.controller = new AbortController();
      job.cancelled = false;
      job.state = "queued";
      job.progress = 0;
      publish();
      pump();
    },
    dismiss(id: string) {
      jobs.current = jobs.current.filter(
        (job) => job.id !== id || !["done", "cancelled"].includes(job.state),
      );
      publish();
    },
  };
}
