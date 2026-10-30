import type { Completion, CompletionContext, CompletionSource } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import type { CharacterSummary } from "../lib/world-mirror.ts";
import { BLOCKS, turnInto } from "./blocks.ts";
import { characterHref } from "./links.ts";

/** What to draw in front of an option: a block's glyph, or a character's ring colour. */
export const GLYPHS = new WeakMap<Completion, string>();
export const RINGS = new WeakMap<Completion, string>();

/** Menu options draw the glyph or ring their source gave them (see `addToOptions`). */
export const optionDecorations = [
  {
    position: 20,
    render(completion: Completion): HTMLElement | null {
      const glyph = GLYPHS.get(completion);
      const ring = RINGS.get(completion);
      if (glyph === undefined && ring === undefined) return null;
      const element = document.createElement("span");
      if (glyph !== undefined) {
        element.className = "cm-dp-glyph";
        element.textContent = glyph;
      } else {
        element.className = "cm-dp-ring";
        element.style.setProperty("--ring", ring!);
      }
      return element;
    },
  },
];

/** True when the character before `at` is the start of the text or a space. */
function startsWord(context: CompletionContext, at: number): boolean {
  return at === 0 || /\s/.test(context.state.sliceDoc(at - 1, at));
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** `/` at the start of a line or after a space: the blocks, filtered by what follows. */
export const slashSource: CompletionSource = (context) => {
  const typed = context.matchBefore(/\/[\w-]*$/);
  if (!typed || !startsWord(context, typed.from)) return null;
  const query = squash(typed.text.slice(1));
  const options = BLOCKS.filter((b) => squash(b.label).includes(query)).map((block): Completion => {
    const option: Completion = {
      label: block.label,
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        const slash = from - 1;
        view.dispatch({ changes: { from: slash, to } }); // takes out the "/query"
        const line = view.state.doc.lineAt(Math.min(slash, view.state.doc.length));
        const spec = view.state.changes(
          turnInto(view.state.doc.toString(), line.from, line.to, block.type),
        );
        view.dispatch({
          changes: spec,
          selection: { anchor: spec.mapPos(line.to, block.type === "code" ? -1 : 1) },
          userEvent: "input.complete",
        });
      },
    };
    GLYPHS.set(option, block.glyph);
    return option;
  });
  return options.length === 0 ? null : { from: typed.from + 1, options, filter: false };
};

const escapeLabel = (name: string) => name.replace(/[\\[\]]/g, (c) => `\\${c}`);

/** `@` at the start of a line or after a space: the world's characters, whose name starts with what follows. */
export function mentionSource(characters: () => CharacterSummary[]): CompletionSource {
  return (context) => {
    const typed = context.matchBefore(/@[^@\n[\]()]{0,30}$/);
    if (!typed || !startsWord(context, typed.from)) return null;
    const query = typed.text.slice(1).trim().normalize("NFC").toLowerCase();
    const matches = characters().filter((c) => {
      const name = c.name.normalize("NFC").toLowerCase();
      return query === "" || name.startsWith(query) || name.includes(` ${query}`);
    });
    if (matches.length === 0) return null;
    const options = matches.map((character): Completion => {
      const option: Completion = {
        label: character.name,
        apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
          view.dispatch({
            changes: {
              from: from - 1,
              to,
              insert: `[${escapeLabel(character.name)}](${characterHref(character.id)})`,
            },
            userEvent: "input.complete",
          });
        },
      };
      RINGS.set(option, character.color);
      return option;
    });
    return { from: typed.from + 1, options, filter: false };
  };
}
