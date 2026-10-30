import { GFM, parser } from "@lezer/markdown";
import { parseCharacterHref, safeWebHref } from "./links.ts";

/** What the live preview does to a stretch of the notes. */
export type PreviewKind =
  | "hide"
  | "heading"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "divider"
  | "code-block"
  | "inline-code"
  | "bold"
  | "italic"
  | "strike"
  | "web-link"
  | "character-link"
  | "plain-link";

export interface PreviewRange {
  from: number;
  to: number;
  kind: PreviewKind;
  /** Headings: 1 to 3. */
  level?: 1 | 2 | 3;
  /** Tasks: whether the box is ticked, and where its `[` is. */
  checked?: boolean;
  at?: number;
  /** Web links: the address. */
  href?: string;
  /** Character links: who, and the name the link was written with. */
  id?: string;
  label?: string;
}

const markdown = parser.configure(GFM);

/** Offsets of each line's start, so a position can be turned into a line number. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

/**
 * Works out how the notes are drawn: which stretches are styled, and which
 * markup is hidden. Markup shows on the lines in `activeLines` (1-based) while
 * editing, as in Obsidian; in view mode it is always hidden. Bullets and
 * checkboxes stay drawn on every line, so a box can always be ticked.
 */
export function previewRanges(
  text: string,
  activeLines: ReadonlySet<number>,
  mode: "view" | "edit",
): PreviewRange[] {
  const starts = lineStarts(text);
  const lineOf = (position: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle]! <= position) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
  const showsMarkup = (position: number) => mode === "edit" && activeLines.has(lineOf(position));
  /** One space after a marker goes with it. */
  const withSpace = (end: number) => (text[end] === " " ? end + 1 : end);

  const ranges: PreviewRange[] = [];
  const hide = (from: number, to: number) => {
    if (to > from && !showsMarkup(from)) ranges.push({ from, to, kind: "hide" });
  };

  markdown.parse(text).iterate({
    enter(node) {
      const { name, from, to } = node;
      const heading = /^ATXHeading([1-6])$/.exec(name);
      if (heading) {
        const level = Math.min(3, Number(heading[1])) as 1 | 2 | 3;
        ranges.push({ from, to, kind: "heading", level });
        return;
      }
      switch (name) {
        case "HeaderMark":
          hide(from, withSpace(to));
          return;
        case "ListItem": {
          const mark = node.node.getChild("ListMark");
          if (!mark) return;
          const box = node.node.getChild("Task")?.getChild("TaskMarker");
          if (box) {
            ranges.push({
              from: mark.from,
              to: withSpace(box.to),
              kind: "task",
              checked: /^\[[xX]\]$/.test(text.slice(box.from, box.to)),
              at: box.from,
            });
          } else if (node.node.parent?.name === "OrderedList") {
            ranges.push({ from: mark.from, to: mark.to, kind: "ordered" });
          } else {
            ranges.push({ from: mark.from, to: withSpace(mark.to), kind: "bullet" });
          }
          return;
        }
        case "Blockquote":
          ranges.push({ from, to, kind: "quote" });
          return;
        case "QuoteMark":
          hide(from, withSpace(to));
          return;
        case "HorizontalRule":
          ranges.push({ from, to, kind: "divider" });
          hide(from, to);
          return;
        case "FencedCode":
          ranges.push({ from, to, kind: "code-block" });
          return;
        case "InlineCode":
          ranges.push({ from, to, kind: "inline-code" });
          return;
        case "CodeMark":
          if (node.node.parent?.name === "InlineCode") hide(from, to);
          return;
        case "StrongEmphasis":
          ranges.push({ from, to, kind: "bold" });
          return;
        case "Emphasis":
          ranges.push({ from, to, kind: "italic" });
          return;
        case "Strikethrough":
          ranges.push({ from, to, kind: "strike" });
          return;
        case "EmphasisMark":
        case "StrikethroughMark":
          hide(from, to);
          return;
        case "Link": {
          const marks = node.node.getChildren("LinkMark");
          const url = node.node.getChild("URL");
          const open = marks[0];
          const close = marks[1];
          if (!url || !open || !close) return;
          const href = text.slice(url.from, url.to);
          const id = parseCharacterHref(href);
          if (id) {
            // The chip replaces the whole link, so on its own line the raw text shows instead.
            if (!showsMarkup(from)) {
              ranges.push({
                from,
                to,
                kind: "character-link",
                id,
                label: text.slice(open.to, close.from),
              });
            }
            return false;
          }
          if (safeWebHref(href)) {
            ranges.push({ from: open.to, to: close.from, kind: "web-link", href });
            hide(open.from, open.to);
            hide(close.from, to);
            return;
          }
          ranges.push({ from, to, kind: "plain-link" });
          return false;
        }
      }
    },
  });

  return ranges.sort((a, b) => a.from - b.from || a.to - b.to);
}
