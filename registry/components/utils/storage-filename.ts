function segment(value: string, fallback: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 100)
      .replace(/^_+|_+$/g, "") || fallback
  );
}

/** Immutable upload name; callers retain unique object directories. */
export function storageFilename(name: string, type: string, extension?: string) {
  const basename = name.split(/[/\\]/).at(-1) ?? "";
  const suffix = /\.([a-z0-9]{1,16})$/i.exec(basename);
  const stem = suffix ? basename.slice(0, -suffix[0].length) : basename;
  const fields = stem
    .trim()
    .replace(/^-+|-+$/g, "")
    .split("-")
    .map((field) => segment(field, ""));
  const modifiers = fields.slice(2).filter((field) => field && field !== "original");
  const filename = [fields[0] || "asset", segment(type, "file"), ...modifiers]
    .join("-")
    .slice(0, 230)
    .replace(/[_-]+$/g, "");
  return `${filename}.${extension ?? suffix?.[1].toLowerCase() ?? "bin"}`;
}
