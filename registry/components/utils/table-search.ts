export function matchesTableSearch(
  search: string,
  ...values: (string | number | null | undefined)[]
) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const text = normalize(values.join(" "));
  return normalize(search)
    .trim()
    .split(/\s+/)
    .every((term) => text.includes(term));
}
