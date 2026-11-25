import { notFound, redirect, type ParsedLocation } from "@tanstack/react-router";

import { publicRecordRedirect, type PublicIdentifier } from "@/components/utils/public-identifier";

export function requireCanonicalRecord<T extends PublicIdentifier>(
  record: T | null,
  identifier: string,
  basePath: string,
  location: ParsedLocation,
): T {
  if (!record) throw notFound();
  const target = publicRecordRedirect(basePath, identifier, record);
  if (target) {
    throw redirect({
      to: target,
      search: location.search,
      hash: location.hash,
      replace: true,
      statusCode: 307,
    });
  }
  return record;
}
