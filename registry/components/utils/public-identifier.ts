/** Public URLs accept a saved slug or a PostgreSQL UUID in the same path segment. */
export const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const publicIdPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export function slugify(value: string, maxLength = 120) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}

export interface PublicIdentifier {
  id: string;
  slug?: string | null;
}

function canonicalIdentifier(record: PublicIdentifier) {
  return record.slug || record.id;
}

export function publicRecordPath(basePath: string, record: PublicIdentifier) {
  return basePath.replace(/\/$/, "") + "/" + encodeURIComponent(canonicalIdentifier(record));
}

export function publicRecordRedirect(
  basePath: string,
  identifier: string,
  record: PublicIdentifier,
) {
  return identifier === canonicalIdentifier(record) ? null : publicRecordPath(basePath, record);
}

/** The caller scopes every lookup to visible records in the requested locale. */
export async function resolvePublicIdentifier<T>(
  identifier: string,
  findPublished: (
    field: "slug" | "id",
    value: string,
  ) => T | undefined | null | Promise<T | undefined | null>,
): Promise<T | null> {
  if (typeof identifier !== "string") return null;
  // An exact published slug keeps its existing URL, including older UUID-shaped slugs.
  if (publicSlugPattern.test(identifier)) {
    const record = await findPublished("slug", identifier);
    if (record != null) return record;
  }
  if (publicIdPattern.test(identifier))
    return (await findPublished("id", identifier.toLowerCase())) ?? null;
  return null;
}
