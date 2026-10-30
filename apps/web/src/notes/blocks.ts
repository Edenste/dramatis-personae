import { GFM, parser } from "@lezer/markdown";

export type BlockType =
  "text" | "h1" | "h2" | "h3" | "bullet" | "ordered" | "todo" | "quote" | "divider" | "code";

/** The blocks both the `/` menu and Turn into offer, in order. `icon` names a Lucide icon. */
export const BLOCKS: Array<{ type: BlockType; label: string; glyph: string; icon: string }> = [
  { type: "text", label: "Text", glyph: "T", icon: "Type" },
  { type: "h1", label: "Heading 1", glyph: "H1", icon: "Heading1" },
  { type: "h2", label: "Heading 2", glyph: "H2", icon: "Heading2" },
  { type: "h3", label: "Heading 3", glyph: "H3", icon: "Heading3" },
  { type: "bullet", label: "Bulleted list", glyph: "•", icon: "List" },
  { type: "ordered", label: "Numbered list", glyph: "1.", icon: "ListOrdered" },
  { type: "todo", label: "To-do list", glyph: "☐", icon: "ListTodo" },
  { type: "quote", label: "Quote", glyph: "❝", icon: "Quote" },
  { type: "divider", label: "Divider", glyph: "—", icon: "Minus" },
  { type: "code", label: "Code block", glyph: "</>", icon: "Code" },
];

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/** A line's block marker: a heading's #, a list's bullet or number, a to-do's box, a quote's >. */
const MARKER = /^(?:#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> )/;

const PREFIX: Partial<Record<BlockType, string>> = {
  text: "",
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
  todo: "- [ ] ",
  quote: "> ",
};

/** The lines a selection touches, as their start and end offsets. */
function linesOf(doc: string, from: number, to: number): Array<{ start: number; end: number }> {
  // A selection that ends at the start of a line doesn't take that line.
  const last = to > from && doc[to - 1] === "\n" ? to - 1 : to;
  const lines: Array<{ start: number; end: number }> = [];
  let start = doc.lastIndexOf("\n", from - 1) + 1;
  for (;;) {
    const newline = doc.indexOf("\n", start);
    const end = newline === -1 ? doc.length : newline;
    lines.push({ start, end });
    if (newline === -1 || newline >= last) return lines;
    start = newline + 1;
  }
}

/**
 * The text changes that turn the lines in `from..to` into another block,
 * in the original text's positions. Text on the lines is kept.
 */
export function turnInto(doc: string, from: number, to: number, type: BlockType): TextChange[] {
  const lines = linesOf(doc, from, to);
  const first = lines[0]!;
  const last = lines.at(-1)!;

  if (type === "code") {
    return [
      { from: first.start, to: first.start, insert: "```\n" },
      { from: last.end, to: last.end, insert: "\n```" },
    ];
  }
  if (type === "divider") {
    const blank = lines.length === 1 && doc.slice(first.start, first.end).trim() === "";
    return blank
      ? [{ from: first.start, to: first.end, insert: "---" }]
      : [{ from: last.end, to: last.end, insert: "\n---" }];
  }
  return lines.map(({ start, end }, i) => {
    const marker = MARKER.exec(doc.slice(start, end))?.[0] ?? "";
    const insert = type === "ordered" ? `${i + 1}. ` : (PREFIX[type] ?? "");
    return { from: start, to: start + marker.length, insert };
  });
}

const markdown = parser.configure(GFM);

/** Blocks that stand on their own, wherever they sit. */
const WHOLE =
  /^(?:ATXHeading[1-6]|SetextHeading[12]|FencedCode|CodeBlock|HorizontalRule|ListItem|Table|HTMLBlock|Blockquote)$/;

/** The Markdown block holding a position: a paragraph, heading, list item, quote or code block. */
export function blockAt(doc: string, pos: number): { from: number; to: number } | null {
  const tree = markdown.parse(doc);
  for (const side of [1, -1] as const) {
    for (
      let node = tree.resolve(pos, side) as typeof tree.topNode | null;
      node;
      node = node.parent
    ) {
      if (
        WHOLE.test(node.name) ||
        (node.name === "Paragraph" && node.parent?.name === "Document")
      ) {
        return { from: node.from, to: node.to };
      }
    }
  }
  return null;
}
