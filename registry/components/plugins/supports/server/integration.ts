import type {
  SupportActivity,
  SupportAuthor,
  SupportTicket,
} from "@/components/plugins/supports/types";
import type { DatabaseTransaction } from "@/components/utils/database";

export type SupportMutation =
  | { kind: "create"; ticketId: string }
  | { kind: "comment" | "status"; ticketId: string; activityId: string };

/** Trusted server composition only; never expose this port through browser transport. */
export interface SupportsIntegration<Context> {
  authorize(
    context: Context,
    permission: "read" | "comment",
    ticketId: string,
  ): Promise<SupportAuthor>;
  snapshot(
    tx: DatabaseTransaction,
    ticketId: string,
  ): Promise<{ ticket: SupportTicket; activity: SupportActivity[] }>;
  lock(tx: DatabaseTransaction, ticketId: string): Promise<void>;
  apply(
    tx: DatabaseTransaction,
    ticketId: string,
    input: Omit<SupportActivity, "attachments">,
  ): Promise<void>;
}
