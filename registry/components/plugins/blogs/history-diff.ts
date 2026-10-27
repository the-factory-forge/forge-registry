import { diffArrays, diffWordsWithSpace, type Change } from "diff";

export interface BlogDiffRow {
  kind: "context" | "removed" | "added";
  parts: (Pick<Change, "value"> & Partial<Pick<Change, "added" | "removed">>)[];
}

/** Bound comparison work for the maximum-size Markdown accepted by the editor. */
export function blogTextDiff(before: string, after: string): BlogDiffRow[] {
  const changes = diffArrays(before.split(/\n\n/), after.split(/\n\n/), { timeout: 50 });
  if (!changes)
    return [
      { kind: "removed", parts: [{ value: before, removed: true }] },
      { kind: "added", parts: [{ value: after, added: true }] },
    ];
  const rows: BlogDiffRow[] = [];
  for (let index = 0; index < changes.length;) {
    const change = changes[index];
    if (!change.added && !change.removed) {
      rows.push(...change.value.map((value) => ({ kind: "context" as const, parts: [{ value }] })));
      index++;
      continue;
    }
    const removed: string[] = [],
      added: string[] = [];
    while (index < changes.length && (changes[index].added || changes[index].removed)) {
      const part = changes[index++];
      (part.removed ? removed : added).push(...part.value);
    }
    for (let line = 0; line < Math.max(removed.length, added.length); line++) {
      const parts = diffWordsWithSpace(removed[line] ?? "", added[line] ?? "", { timeout: 50 }) ?? [
        { value: removed[line] ?? "", removed: true },
        { value: added[line] ?? "", added: true },
      ];
      if (parts.some((part) => part.removed && part.value))
        rows.push({ kind: "removed", parts: parts.filter((part) => !part.added) });
      if (parts.some((part) => part.added && part.value))
        rows.push({ kind: "added", parts: parts.filter((part) => !part.removed) });
    }
  }
  return rows;
}
