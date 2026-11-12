export type SupportsGithubState = "unlinked" | "pending" | "synchronized" | "failed" | "blocked";
export type SupportsGithubFailure =
  | "DELIVERY"
  | "ACCESS"
  | "REPOSITORY"
  | "UNCERTAIN"
  | "MISSING"
  | "TOO_LONG"
  | "STALE_STATUS";
export interface SupportsGithubConnection {
  state: SupportsGithubState;
  issueUrl: string | null;
  failure: SupportsGithubFailure | null;
  pending: number;
  canRetry: boolean;
}
export interface SupportsGithubClient {
  get(ticketId: string): Promise<SupportsGithubConnection>;
  exportTicket(ticketId: string): Promise<void>;
  retry(ticketId: string): Promise<void>;
}
