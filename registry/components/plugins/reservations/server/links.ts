import { createHmac, timingSafeEqual } from "node:crypto";

import { ReservationError } from "@/components/plugins/reservations/types";

export function signManagementLink(id: string, version: number, expiresAt: number, secret: string) {
  const payload = Buffer.from(JSON.stringify({ id, version, expiresAt })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyManagementLink(
  token: string,
  secret: string,
  now: number,
): { id: string; version: number } {
  try {
    if (typeof token !== "string" || token.length > 1024) throw new Error();
    const parts = token.split(".");
    if (parts.length !== 2) throw new Error();
    const expected = createHmac("sha256", secret).update(parts[0]).digest();
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const value: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !("version" in value) ||
      typeof value.version !== "number" ||
      !Number.isInteger(value.version) ||
      !("expiresAt" in value) ||
      typeof value.expiresAt !== "number" ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    )
      throw new Error();
    return { id: value.id, version: value.version };
  } catch {
    throw new ReservationError("INVALID_LINK");
  }
}
