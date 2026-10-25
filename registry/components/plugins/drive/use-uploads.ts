"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DriveTransfer } from "@/components/plugins/drive/transfer";
import { transferDriveUpload } from "@/components/plugins/drive/transfer";
import type { DriveClient, DriveScope } from "@/components/plugins/drive/types";
import { DriveError, errorCode, folderUploadPath } from "@/components/plugins/drive/utils";

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
  parentId: string | null;
  relativePath?: string;
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
  const generation = useRef(0);
  const [uploads, setUploads] = useState<Job[]>([]);
  const [previousParentId, setPreviousParentId] = useState(parentId);
  if (previousParentId !== parentId) {
    setPreviousParentId(parentId);
    setUploads([]);
  }
  const publish = useCallback(() => {
    if (mounted.current) setUploads(jobs.current.map((job) => ({ ...job })));
  }, []);
  const dismiss = useCallback(
    (id: string) => {
      jobs.current = jobs.current.filter(
        (job) => job.id !== id || !["done", "cancelled"].includes(job.state),
      );
      publish();
    },
    [publish],
  );
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
    const started = generation.current;
    job.busy = true;
    job.state = "uploading";
    job.error = undefined;
    publish();
    try {
      if (job.relativePath !== undefined) {
        if (!client.prepareFolderUpload) throw new DriveError("INVALID");
        folderUploadPath(job.relativePath, job.file.name);
      }
      // Mark before preparation: a lost preparation response may still reserve a file.
      job.reserved = true;
      const input = {
        scope,
        parentId: job.parentId,
        requestId: job.id,
        name: job.file.name,
        size: job.file.size,
        contentType: job.file.type,
      };
      const ticket =
        job.relativePath !== undefined
          ? await client.prepareFolderUpload!({ ...input, relativePath: job.relativePath })
          : await client.prepareUpload(input);
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
          if (mounted.current && !job.cancelled) refresh();
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
      if (mounted.current && !job.cancelled) refresh();
    } catch (error) {
      if (job.cancelled) await abandon(job);
      else {
        job.state = "failed";
        job.error = error;
      }
    } finally {
      job.busy = false;
      publish();
      if (generation.current === started) pump();
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
      generation.current += 1;
      const departed = jobs.current;
      jobs.current = [];
      for (const job of departed) {
        if (["done", "cancelled"].includes(job.state)) continue;
        job.cancelled = true;
        job.controller.abort();
        if (!job.busy) void abandon(job);
      }
    };
    // Space changes remount the browser; folder changes cancel only this queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);
  return {
    uploads,
    add(files: File[], maxBytes: number, destination = parentId, directory = false) {
      for (const file of files) {
        let error: unknown;
        try {
          if (file.size > maxBytes) throw new DriveError("INVALID");
          if (directory) {
            if (!client.prepareFolderUpload) throw new DriveError("INVALID");
            folderUploadPath(file.webkitRelativePath, file.name);
          }
        } catch (reason) {
          error = reason;
        }
        jobs.current.push({
          id: crypto.randomUUID(),
          file,
          parentId: destination,
          relativePath: directory ? file.webkitRelativePath : undefined,
          state: error ? "failed" : "queued",
          error,
          progress: 0,
          controller: new AbortController(),
          reserved: false,
          busy: false,
          cancelled: false,
        });
      }
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
    dismiss,
  };
}
