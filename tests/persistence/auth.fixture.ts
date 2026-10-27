import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { and, eq, like } from "drizzle-orm";

import type { DatabaseTransaction } from "../../registry/components/utils/database.ts";
import * as schema from "./schema.ts";

export function createAuth(database: DatabaseTransaction) {
  return betterAuth({
    secret: "disposable-local-drizzle-integration-secret",
    baseURL: "http://localhost:3000",
    telemetry: { enabled: false },
    database: drizzleAdapter(database, { provider: "pg", schema }),
    plugins: [admin()],
    user: {
      additionalFields: {
        mustChangePassword: { type: "boolean", defaultValue: false, required: false, input: false },
      },
    },
    emailAndPassword: { enabled: true, disableSignUp: true },
    advanced: { database: { joins: true } },
    databaseHooks: {
      user: {
        update: {
          after: async (user, context) => {
            if (context?.path?.startsWith("/admin/"))
              await database
                .delete(schema.verification)
                .where(
                  and(
                    eq(schema.verification.value, user.id),
                    like(schema.verification.identifier, "reset-password:%"),
                  ),
                );
          },
        },
      },
    },
  });
}
