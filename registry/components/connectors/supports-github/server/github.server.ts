import { z } from "zod";

import type { SupportsGithubFailure } from "@/components/connectors/supports-github/contracts";
import type { SupportStatus } from "@/components/plugins/supports/types";

export class SupportsGithubError extends Error {
  code: SupportsGithubFailure | "INVALID" | "FORBIDDEN" | "CONFLICT";
  uncertain: boolean;
  retryAfter: number;
  constructor(code: SupportsGithubError["code"], uncertain = false, retryAfter = 60) {
    super(code);
    this.name = "SupportsGithubError";
    this.code = code;
    this.uncertain = uncertain;
    this.retryAfter = retryAfter;
  }
}
const identifier = z.number().int().positive().safe();
export const githubUser = z
  .object({ id: identifier, login: z.string().min(1).max(200) })
  .nullable();
export const githubIssue = z.object({
  id: identifier,
  number: identifier,
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  state_reason: z.string().nullable().optional(),
  user: githubUser,
  updated_at: z.iso.datetime(),
  created_at: z.iso.datetime(),
  pull_request: z.unknown().optional(),
});
export const githubComment = z.object({
  id: identifier,
  body: z.string(),
  user: githubUser,
  created_at: z.iso.datetime(),
});
const githubEvent = z.object({
  id: identifier,
  event: z.string(),
  actor: githubUser,
  created_at: z.iso.datetime(),
});
export type GithubIssue = z.infer<typeof githubIssue>;
export type GithubComment = z.infer<typeof githubComment>;
export type GithubEvent = z.infer<typeof githubEvent>;
export const repositoryConfig = z.object({
  id: identifier,
  installationId: identifier,
  botUserId: identifier,
  owner: z
    .string()
    .regex(/^[A-Za-z0-9_.-]+$/)
    .max(100),
  name: z
    .string()
    .regex(/^[A-Za-z0-9_.-]+$/)
    .max(100),
});
export type GithubRepository = z.infer<typeof repositoryConfig>;
export const fromGithubStatus = (
  issue: Pick<GithubIssue, "state" | "state_reason">,
): SupportStatus =>
  issue.state === "open"
    ? "open"
    : ["not_planned", "duplicate"].includes(issue.state_reason ?? "")
      ? "canceled"
      : "closed";
export const toGithubStatus = (status: SupportStatus) =>
  status === "open"
    ? { state: "open", state_reason: "reopened" }
    : { state: "closed", state_reason: status === "canceled" ? "not_planned" : "completed" };
export const issueHref = (repo: GithubRepository, number: number) =>
  `https://github.com/${repo.owner}/${repo.name}/issues/${number}`;
export const marker = (jobId: string) => `<!-- forge-supports:${jobId} -->`;
export const hasMarker = (body: string | null, jobId: string) =>
  body?.endsWith(`\n\n${marker(jobId)}`) === true;

export function createGithubClient(options: {
  repository: GithubRepository;
  getAccessToken(): Promise<string>;
  request?: typeof fetch;
}) {
  const repo = repositoryConfig.parse(options.repository);
  const path = `/repos/${repo.owner}/${repo.name}`;
  async function request<T>(
    route: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (typeof token !== "string" || !token.trim() || /[\r\n]/.test(token))
      throw new SupportsGithubError("ACCESS");
    let response: Response;
    try {
      response = await (options.request ?? fetch)(`https://api.github.com${route}`, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new SupportsGithubError("DELIVERY", method !== "GET");
    }
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
      const limited =
        response.status === 429 ||
        (response.status === 403 &&
          (retry > 0 || response.headers.get("x-ratelimit-remaining") === "0"));
      if (limited)
        throw new SupportsGithubError(
          "DELIVERY",
          false,
          Math.max(60, retry || 0, Math.ceil((reset - Date.now()) / 1000)),
        );
      if ([401, 403].includes(response.status)) throw new SupportsGithubError("ACCESS");
      if (response.status === 404 || response.status === 410)
        throw new SupportsGithubError("MISSING");
      if (response.status >= 300 && response.status < 400)
        throw new SupportsGithubError("REPOSITORY");
      throw new SupportsGithubError(
        "DELIVERY",
        method !== "GET" && (response.status >= 500 || response.status === 408),
      );
    }
    try {
      return schema.parse(await response.json());
    } catch {
      throw new SupportsGithubError("DELIVERY", method !== "GET");
    }
  }
  async function pages<T>(route: string, schema: z.ZodType<T>) {
    const rows: T[] = [];
    const deadline = Date.now() + 90000;
    for (let page = 1; Date.now() < deadline; page++) {
      const result = await request(
        `${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        z.array(schema),
      );
      rows.push(...result);
      if (result.length < 100) return rows;
    }
    // Leave enough of the ticket lease for durable finalization; never return a partial scan.
    throw new SupportsGithubError("DELIVERY");
  }
  return {
    async verify() {
      const repository = await request(
        `/repositories/${repo.id}`,
        z.object({
          id: identifier,
          private: z.boolean(),
          visibility: z.string(),
          full_name: z.string(),
          archived: z.boolean(),
          has_issues: z.boolean(),
        }),
      );
      if (
        repository.id !== repo.id ||
        !repository.private ||
        repository.visibility !== "private" ||
        repository.archived ||
        !repository.has_issues ||
        repository.full_name.toLowerCase() !== `${repo.owner}/${repo.name}`.toLowerCase()
      )
        throw new SupportsGithubError("REPOSITORY");
    },
    async issue(number: number) {
      const issue = await request(`${path}/issues/${number}`, githubIssue);
      if (issue.pull_request !== undefined) throw new SupportsGithubError("MISSING");
      return issue;
    },
    comments: (number: number) => pages(`${path}/issues/${number}/comments`, githubComment),
    commentPage: (number: number, page: number) =>
      request(
        `${path}/issues/${number}/comments?per_page=100&page=${page}`,
        z.array(githubComment),
      ),
    events: (number: number) => pages(`${path}/issues/${number}/events`, githubEvent),
    // Issue discovery uses the marker, not eventually consistent search results.
    issues: () => pages(`${path}/issues?state=all&sort=created&direction=desc`, githubIssue),
    create: (title: string, body: string) =>
      request(`${path}/issues`, githubIssue, "POST", { title, body }),
    comment: (number: number, body: string) =>
      request(`${path}/issues/${number}/comments`, githubComment, "POST", { body }),
    setStatus: (number: number, status: SupportStatus) =>
      request(`${path}/issues/${number}`, githubIssue, "PATCH", toGithubStatus(status)),
  };
}
export type GithubClient = ReturnType<typeof createGithubClient>;
