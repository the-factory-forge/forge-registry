import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

import type { SupportsGithubFailure } from "@/components/connectors/supports-github/contracts";
import { supportsTickets } from "@/components/plugins/supports/server/schema";
import type { SupportAuthor, SupportStatus } from "@/components/plugins/supports/types";

export interface GithubJobPayload {
  title?: string;
  body?: string;
  status?: SupportStatus;
  baseRevision?: string;
  author?: SupportAuthor;
  sourceAt?: string;
  remoteId?: number;
  sourceUrl?: string;
  tooLong?: boolean;
}
export const supportsGithubBindings = pgTable(
  "supports_github_binding",
  {
    ticketId: text("ticket_id")
      .primaryKey()
      .references(() => supportsTickets.id),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    issueId: bigint("issue_id", { mode: "number" }),
    issueNumber: integer("issue_number"),
    issueUrl: text("issue_url"),
    remoteRevision: text("remote_revision").notNull().default(""),
    externalRevision: text("external_revision").notNull().default(""),
    commentPage: integer("comment_page").notNull().default(1),
    failure: text("failure").$type<SupportsGithubFailure>(),
    lease: text("lease"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("supports_github_issue").on(table.repositoryId, table.issueId)],
);

export const supportsGithubJobs = pgTable(
  "supports_github_job",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportsGithubBindings.ticketId),
    sourceKey: text("source_key").notNull().unique(),
    direction: text("direction").$type<"inbound" | "outbound">().notNull(),
    kind: text("kind").$type<"create" | "comment" | "status" | "missing">().notNull(),
    state: text("state")
      .$type<"pending" | "sending" | "failed" | "blocked" | "done" | "redacted">()
      .notNull()
      .default("pending"),
    payload: jsonb("payload").$type<GithubJobPayload>().notNull(),
    failure: text("failure").$type<SupportsGithubFailure>(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("supports_github_queue").on(table.ticketId, table.createdAt, table.id)],
);

// Keep source keys after redaction so webhook redelivery and reconciliation cannot resurrect content.
export const supportsGithubMessages = pgTable("supports_github_message", {
  sourceKey: text("source_key").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportsGithubBindings.ticketId),
  jobId: text("job_id").references(() => supportsGithubJobs.id),
  remoteId: bigint("remote_id", { mode: "number" }),
  activityId: text("activity_id"),
  redacted: integer("redacted").notNull().default(0),
});
export const supportsGithubDeliveries = pgTable("supports_github_delivery", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
});
export type GithubBinding = typeof supportsGithubBindings.$inferSelect;
export type GithubJob = typeof supportsGithubJobs.$inferSelect;
