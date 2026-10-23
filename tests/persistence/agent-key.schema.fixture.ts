// Template schema fixture: forge-template 1ed3eb20962adcf9235b5f35ac74a405f8f216e7.
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.schema.fixture.ts";

export const agentKey = pgTable(
  "agent_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    encryptedToken: text("encrypted_token").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("agent_key_user_id_idx").on(table.userId)],
);
