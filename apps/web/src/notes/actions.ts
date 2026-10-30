import { BLOCKS, blockAt, type TextChange } from "./blocks.ts";

/** One row of the right-click menu. `icon` names a Lucide icon. */
export interface NoteAction {
  id: string;
  label: string;
  icon: string;
  danger?: boolean;
  submenu?: NoteAction[];
}

/**
 * The menu's rows in groups, which the menu separates with dividers: Turn into,
 * formatting (only with text selected), the clipboard, then Delete block.
 */
export function contextGroups(hasSelection: boolean): NoteAction[][] {
  const groups: NoteAction[][] = [
    [
      {
        id: "turn-into",
        label: "Turn into",
        icon: "Repeat2",
        submenu: BLOCKS.map((b) => ({ id: `turn:${b.type}`, label: b.label, icon: b.icon })),
      },
    ],
  ];
  if (hasSelection) {
    groups.push([
      { id: "bold", label: "Bold", icon: "Bold" },
      { id: "italic", label: "Italic", icon: "Italic" },
      { id: "strike", label: "Strikethrough", icon: "Strikethrough" },
      { id: "code", label: "Code", icon: "Code" },
      { id: "link", label: "Link…", icon: "Link" },
    ]);
  }
  groups.push(
    [
      { id: "cut", label: "Cut", icon: "Scissors" },
      { id: "copy", label: "Copy", icon: "Copy" },
      { id: "paste", label: "Paste", icon: "ClipboardPaste" },
    ],
    [{ id: "delete-block", label: "Delete block", icon: "Trash2", danger: true }],
  );
  return groups;
}

/** Every action, with the Turn into items in place of Turn into, whose label contains the search. */
export function filterActions(groups: NoteAction[][], query: string): NoteAction[] {
  const flat = groups.flat().flatMap((action) => action.submenu ?? [action]);
  const needle = query.trim().toLowerCase();
  return needle === "" ? flat : flat.filter((a) => a.label.toLowerCase().includes(needle));
}

/** Puts `mark` around `from..to`, or takes it off if it is already there. */
export function toggleMarks(
  doc: string,
  from: number,
  to: number,
  mark: "**" | "*" | "~~" | "`",
): TextChange[] {
  const size = mark.length;
  // A single * sitting inside ** is bold's, not italic's.
  const own = (at: number, step: -1 | 1) =>
    doc.slice(at, at + size) === mark && !(mark === "*" && doc[at + step] === "*");
  const outsideStart = from - size;
  if (outsideStart >= 0 && own(outsideStart, -1) && own(to, 1)) {
    return [
      { from: outsideStart, to: from, insert: "" },
      { from: to, to: to + size, insert: "" },
    ];
  }
  const text = doc.slice(from, to);
  if (text.length >= size * 2 && text.startsWith(mark) && text.endsWith(mark)) {
    return [
      { from, to: from + size, insert: "" },
      { from: to - size, to, insert: "" },
    ];
  }
  return [
    { from, to: from, insert: mark },
    { from: to, to, insert: mark },
  ];
}

/** Deletes the block holding `pos`, with one line break so no gap is left; null if there is none. */
export function deleteBlockChange(doc: string, pos: number): TextChange | null {
  const block = blockAt(doc, pos);
  if (!block) return null;
  if (doc[block.to] === "\n") return { from: block.from, to: block.to + 1, insert: "" };
  if (block.from > 0 && doc[block.from - 1] === "\n") {
    return { from: block.from - 1, to: block.to, insert: "" };
  }
  return { from: block.from, to: block.to, insert: "" };
}
