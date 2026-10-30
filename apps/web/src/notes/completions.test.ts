import { CompletionContext, type Completion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import type { CharacterSummary } from "../lib/world-mirror.ts";
import { mentionSource, slashSource } from "./completions.ts";

const characters: CharacterSummary[] = [
  { id: "arthurxxxxxxxxxx", name: "Arthur", color: "#3b6fd4" },
  { id: "lancelotxxxxxxxx", name: "Lancelot", color: "#3b6fd4" },
  { id: "ladyxxxxxxxxxxxx", name: "Lady of the Lake", color: "#99aab5" },
  { id: "morganxxxxxxxxxx", name: "Morgan le Fay", color: "#99aab5" },
];

/** Runs a source at the end of `doc`, as the editor would after the last keystroke. */
async function ask(source: typeof slashSource, doc: string) {
  const state = EditorState.create({ doc });
  const result = await source(new CompletionContext(state, doc.length, false));
  const view = new EditorView({ state, parent: document.body });
  return { result, view };
}

/** Picks an option the way the menu does: its `apply` gets the view and the typed range. */
function pick(
  view: EditorView,
  result: NonNullable<Awaited<ReturnType<typeof slashSource>>>,
  label: string,
) {
  const option = result.options.find((o) => o.label === label) as Completion;
  (option.apply as (v: EditorView, c: Completion, from: number, to: number) => void)(
    view,
    option,
    result.from,
    view.state.doc.length,
  );
  return view.state.doc.toString();
}

describe("slashSource", () => {
  it("offers the blocks after a / at the start of a line", async () => {
    const { result } = await ask(slashSource, "/he");
    expect(result!.from).toBe(1);
    expect(result!.options.map((o) => o.label)).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
  });

  it("offers every block for a bare /", async () => {
    const { result } = await ask(slashSource, "/");
    expect(result!.options).toHaveLength(10);
  });

  it("works after a space, and ignores a / inside a word", async () => {
    expect((await ask(slashSource, "so /q")).result!.options.map((o) => o.label)).toEqual([
      "Quote",
    ]);
    expect((await ask(slashSource, "a/b")).result).toBeNull();
    expect((await ask(slashSource, "plain")).result).toBeNull();
  });

  it("turns the line into the chosen block and removes what was typed", async () => {
    const { result, view } = await ask(slashSource, "/he");
    expect(pick(view, result!, "Heading 2")).toBe("## ");
  });

  it("turns a line with text on it, keeping the text", async () => {
    const { result, view } = await ask(slashSource, "Backstory /todo");
    expect(pick(view, result!, "To-do list")).toBe("- [ ] Backstory ");
  });

  it("makes a divider on its own empty line", async () => {
    const { result, view } = await ask(slashSource, "/div");
    expect(pick(view, result!, "Divider")).toBe("---");
  });
});

describe("mentionSource", () => {
  const source = mentionSource(() => characters);

  it("offers characters whose name has a word starting with what was typed", async () => {
    const names = async (doc: string) =>
      (await ask(source, doc)).result!.options.map((o) => o.label);
    expect(await names("@")).toEqual(["Arthur", "Lancelot", "Lady of the Lake", "Morgan le Fay"]);
    expect(await names("see @la")).toEqual(["Lancelot", "Lady of the Lake"]);
    expect(await names("@OF")).toEqual(["Lady of the Lake"]);
    expect(await names("@lady of")).toEqual(["Lady of the Lake"]);
  });

  it("starts after the @, and not in the middle of a word", async () => {
    expect((await ask(source, "see @la")).result!.from).toBe(5);
    expect((await ask(source, "mail kay@la")).result).toBeNull();
  });

  it("inserts a character link", async () => {
    const { result, view } = await ask(source, "see @lan");
    expect(pick(view, result!, "Lancelot")).toBe("see [Lancelot](character:lancelotxxxxxxxx)");
  });

  it("keeps brackets in a name from breaking the link", async () => {
    const odd = mentionSource(() => [
      { id: "oddxxxxxxxxxxxxx", name: "Sir [Bors]", color: "#000000" },
    ]);
    const { result, view } = await ask(odd, "@sir");
    expect(pick(view, result!, "Sir [Bors]")).toBe("[Sir \\[Bors\\]](character:oddxxxxxxxxxxxxx)");
  });

  it("offers nothing when no one matches", async () => {
    expect((await ask(source, "@zzz")).result).toBeNull();
  });
});
