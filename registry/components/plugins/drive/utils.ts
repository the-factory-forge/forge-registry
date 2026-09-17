import type { DriveScope, DriveSort, DriveSpace } from "@/components/plugins/drive/types";
export const DEFAULT_MAX_FILE_BYTES = 100_000_000;
export const scopeKey = (scope: DriveScope) => JSON.stringify([scope.type, scope.id]);
export type DriveErrorCode =
  | "INVALID"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "EXPIRED"
  | "DELETE_PENDING"
  | "STORAGE";
export class DriveError extends Error {
  readonly code: DriveErrorCode;
  constructor(code: DriveErrorCode) {
    super(code);
    this.name = "DriveError";
    this.code = code;
  }
}
export function validName(input: string) {
  if (typeof input !== "string") throw new DriveError("INVALID");
  const name = input.trim();
  if (
    !name ||
    name.length > 255 ||
    name === "." ||
    name === ".." ||
    /[/\\]/.test(name) ||
    name.split("").some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    throw new DriveError("INVALID");
  return name;
}
export function validScope(scope: DriveScope) {
  if (
    !scope ||
    typeof scope.type !== "string" ||
    typeof scope.id !== "string" ||
    !scope.type.trim() ||
    !scope.id.trim() ||
    scope.type.length > 100 ||
    scope.id.length > 512
  )
    throw new DriveError("INVALID");
  return scope;
}
export function validId(id: string) {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new DriveError("INVALID");
  return id;
}
export function errorCode(error: unknown): DriveErrorCode | undefined {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    [
      "INVALID",
      "NOT_FOUND",
      "FORBIDDEN",
      "CONFLICT",
      "EXPIRED",
      "DELETE_PENDING",
      "STORAGE",
    ].includes(error.code)
  )
    return error.code as DriveErrorCode;
}
export function safeDownloadUrl(input: string) {
  try {
    const url = new URL(input);
    return ["http:", "https:", "blob:"].includes(url.protocol) && !url.username && !url.password
      ? input
      : undefined;
  } catch {
    return undefined;
  }
}

export function validSort(sort: DriveSort = { field: "name", direction: "asc" }): DriveSort {
  if (
    !sort ||
    !["name", "updatedAt", "size", "owner"].includes(sort.field) ||
    !["asc", "desc"].includes(sort.direction)
  )
    throw new DriveError("INVALID");
  return sort;
}

/** Compare metadata before pagination; missing values sort last in either direction. */
export function compareDriveItems(
  a: Pick<DriveSpace, "name" | "updatedAt" | "size" | "owner">,
  b: Pick<DriveSpace, "name" | "updatedAt" | "size" | "owner">,
  sort: DriveSort,
) {
  const value = (item: typeof a) => {
    if (sort.field === "owner") return item.owner?.name;
    if (sort.field === "updatedAt") {
      const time = item.updatedAt ? Date.parse(item.updatedAt) : NaN;
      return Number.isFinite(time) ? time : undefined;
    }
    return item[sort.field];
  };
  const left = value(a);
  const right = value(b);
  if (left === undefined && right !== undefined) return 1;
  if (right === undefined && left !== undefined) return -1;
  const order =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left ?? "").localeCompare(String(right ?? ""));
  return order * (sort.direction === "asc" ? 1 : -1) || a.name.localeCompare(b.name);
}
