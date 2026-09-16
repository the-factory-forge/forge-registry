import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  unique,
  foreignKey,
  check,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
export const driveSpaces = pgTable(
  "drive_space",
  {
    id: uuid("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
  },
  (t) => [unique("drive_space_entity").on(t.entityType, t.entityId)],
);
export const driveEntries = pgTable(
  "drive_entry",
  {
    id: uuid("id").primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => driveSpaces.id),
    parentId: uuid("parent_id"),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull().default(0),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    storageId: uuid("storage_id"),
    state: text("state").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("drive_entry_space_id").on(t.spaceId, t.id),
    unique("drive_entry_name").on(t.spaceId, t.parentId, t.name).nullsNotDistinct(),
    foreignKey({
      name: "drive_entry_parent",
      columns: [t.spaceId, t.parentId],
      foreignColumns: [t.spaceId, t.id],
    }),
    check("drive_entry_kind", sql`${t.kind} in ('file', 'folder')`),
    check("drive_entry_state", sql`${t.state} in ('uploading', 'ready', 'deleting')`),
    check("drive_entry_size", sql`${t.size} >= 0`),
    index("drive_entry_cleanup").on(t.state),
  ],
);

export const driveUploads = pgTable(
  "drive_upload",
  {
    id: uuid("id").primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => driveSpaces.id),
    entryId: uuid("entry_id").notNull(),
    storageId: uuid("storage_id").notNull(),
    input: jsonb("input").notNull(),
    state: text("state").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("drive_upload_state", sql`${t.state} in ('active', 'completed', 'cancelled')`),
    index("drive_upload_cleanup").on(t.state, t.expiresAt),
  ],
);
