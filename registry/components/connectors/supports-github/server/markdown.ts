import { parseMarkdown, type BlockNode, type InlineNode } from "@tanstack/markdown";

export const IMPORT_LIMIT = 65536;
export const markdownText = (value: string) =>
  value.replace(/[\\`*_{}[\]<>]/g, (character) =>
    character === "<" ? "&lt;" : character === ">" ? "&gt;" : `\\${character}`,
  );

/** Serialize the existing parser's AST: no raw HTML, remote images or signed asset URLs. */
export function sourceMarkdown(value: string, source: string): string {
  const link = (value: string) => {
    try {
      const url = new URL(value, source);
      if (
        !["https:", "http:", "mailto:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        [...url.searchParams.keys()].some((key) => /token|signature|jwt|x-amz-/i.test(key))
      )
        return source;
      return url.href.replaceAll("(", "%28").replaceAll(")", "%29");
    } catch {
      return source;
    }
  };
  const imageLink = (name: string) =>
    `[${markdownText(name || "Image")} — image not copied](${source})`;
  const html = (value: string) =>
    value
      .split(/(<img\b[^>]*>)/gi)
      .map((part) => (/^<img\b/i.test(part) ? imageLink("Image") : markdownText(part)))
      .join("");
  function inline(nodes: InlineNode[]): string {
    return nodes
      .map((node): string => {
        switch (node.type) {
          case "text":
            return markdownText(node.value);
          case "inlineCode": {
            const fence = "`".repeat(
              Math.max(0, ...Array.from(node.value.matchAll(/`+/g), (match) => match[0].length)) +
                1,
            );
            return `${fence} ${node.value} ${fence}`;
          }
          case "strong":
            return `**${inline(node.children)}**`;
          case "emphasis":
            return `*${inline(node.children)}*`;
          case "strike":
            return `~~${inline(node.children)}~~`;
          case "link":
            return `[${inline(node.children)}](${link(node.href)})`;
          case "image":
            return imageLink(node.alt);
          case "break":
            return "\n";
          case "inlineHtml":
            return html(node.value);
          case "footnoteReference":
            return `[^${node.id}]`;
          case "inlineComponent":
            return inline(node.children);
        }
      })
      .join("");
  }
  function blocks(nodes: BlockNode[]): string {
    return nodes
      .map((node): string => {
        switch (node.type) {
          case "paragraph":
            return inline(node.children);
          case "heading":
            return `${"#".repeat(node.depth)} ${inline(node.children)}`;
          case "code": {
            const fence = "`".repeat(
              Math.max(2, ...Array.from(node.value.matchAll(/`+/g), (match) => match[0].length)) +
                1,
            );
            return `${fence}${node.lang?.replace(/[^\w+-]/g, "") ?? ""}\n${node.value}\n${fence}`;
          }
          case "list":
            return node.items
              .map(
                (item, i) =>
                  `${node.ordered ? `${(node.start ?? 1) + i}.` : "-"} ${item.checked === undefined ? "" : `[${item.checked ? "x" : " "}] `}${blocks(item.children).replaceAll("\n", "\n  ")}`,
              )
              .join("\n");
          case "blockquote":
            return blocks(node.children)
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n");
          case "table": {
            const row = (cells: typeof node.header) =>
              `| ${cells.map((cell) => inline(cell.children).replaceAll("|", "\\|")).join(" | ")} |`;
            return [
              row(node.header),
              `| ${node.header.map(() => "---").join(" | ")} |`,
              ...node.rows.map(row),
            ].join("\n");
          }
          case "thematicBreak":
            return "---";
          case "html":
            return html(node.value);
          case "footnotes":
            return node.items.map((item) => `[^${item.id}]: ${blocks(item.children)}`).join("\n");
          case "callout":
          case "component":
            return blocks(node.children);
        }
      })
      .join("\n\n");
  }
  return blocks(parseMarkdown(value).children);
}
