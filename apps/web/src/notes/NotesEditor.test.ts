import { fireEvent, render, screen } from "@testing-library/svelte";
import { undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterSummary } from "../lib/world-mirror.ts";
import NotesEditor from "./NotesEditor.svelte";

const arthur: CharacterSummary = { id: "c1a9m3x8k2q7v5w0", name: "Arthur", color: "#3b6fd4" };

function mount(
  props: Partial<{ body: string; editable: boolean; known: CharacterSummary[] }> = {},
) {
  const onchange = vi.fn();
  const onopen = vi.fn();
  const known = props.known ?? [];
  const view = render(NotesEditor, {
    body: props.body ?? "",
    editable: props.editable ?? true,
    characters: (id: string) => known.find((c) => c.id === id) ?? null,
    list: () => known,
    onopen,
    onchange,
  } as never);
  const dom = view.container.querySelector<HTMLElement>(".cm-editor")!;
  return { ...view, onchange, onopen, dom, editor: EditorView.findFromDOM(dom)! };
}

const content = (dom: HTMLElement) => dom.querySelector<HTMLElement>(".cm-content")!;

const menuSearch = () => screen.queryByRole("textbox", { name: "Search actions…" });
const rightClick = (dom: HTMLElement, init: MouseEventInit = {}) =>
  fireEvent.contextMenu(content(dom), { clientX: 40, clientY: 40, ...init });

describe("NotesEditor modes", () => {
  it("is read-only in view mode", () => {
    const { dom } = mount({ editable: false });
    expect(content(dom).getAttribute("contenteditable")).toBe("false");
  });

  it("can be typed in in edit mode", () => {
    const { dom } = mount({ editable: true });
    expect(content(dom).getAttribute("contenteditable")).toBe("true");
  });

  it("follows a change of mode without being rebuilt", async () => {
    const view = mount({ editable: false });
    await view.rerender({
      body: "",
      editable: true,
      characters: () => null,
      onopen: view.onopen,
      onchange: view.onchange,
    } as never);
    expect(content(view.dom).getAttribute("contenteditable")).toBe("true");
    expect(view.container.querySelectorAll(".cm-editor")).toHaveLength(1);
  });

  it("names itself Notes", () => {
    const { dom } = mount();
    expect(content(dom).getAttribute("aria-label")).toBe("Notes");
  });
});

describe("NotesEditor changes", () => {
  it("reports what the person types", () => {
    const { editor, onchange } = mount();
    editor.dispatch({ changes: { from: 0, insert: "hello" }, userEvent: "input.type" });
    expect(onchange).toHaveBeenLastCalledWith("hello");
  });

  it("doesn't report text it was handed", () => {
    const { component, editor, onchange } = mount({ body: "old" });
    (component as unknown as { setText(text: string): void }).setText("new");
    expect(editor.state.doc.toString()).toBe("new");
    expect(onchange).not.toHaveBeenCalled();
  });

  it("keeps text handed in out of its undo history, so Ctrl+Z can't undo someone else's edit", () => {
    const { component, editor } = mount({ body: "start" });
    editor.dispatch({
      changes: { from: 0, to: 5, insert: "mine" },
      userEvent: "input.type",
    });
    (component as unknown as { setText(text: string): void }).setText("theirs");
    undo(editor);
    expect(editor.state.doc.toString()).toBe("theirs");
  });

  it("starts with the body it is given", () => {
    const { editor } = mount({ body: "# Backstory\n\nRaised by the lake." });
    expect(editor.state.doc.toString()).toBe("# Backstory\n\nRaised by the lake.");
  });
});

describe("NotesEditor live preview", () => {
  it("draws a heading without its #", () => {
    const { dom } = mount({ body: "# Backstory", editable: false });
    const line = dom.querySelector(".cm-line")!;
    expect(line.classList.contains("cm-dp-h1")).toBe(true);
    expect(line.textContent).toBe("Backstory");
  });

  it("hides the # in an editor that isn't focused, since no line is being edited", () => {
    const { dom } = mount({ body: "# Backstory", editable: true });
    expect(dom.querySelector(".cm-line")!.textContent).toBe("Backstory");
  });

  it("ticks a box in view mode, which is the one edit view mode allows", async () => {
    const { dom, onchange } = mount({ body: "- [ ] polish the sword", editable: false });
    const box = dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(false);
    await fireEvent.click(box);
    expect(onchange).toHaveBeenLastCalledWith("- [x] polish the sword");
  });

  it("unticks a ticked box", async () => {
    const { dom, onchange } = mount({ body: "- [x] done", editable: false });
    await fireEvent.click(dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    expect(onchange).toHaveBeenLastCalledWith("- [ ] done");
  });

  it("shows a character link as a chip that opens them in view mode", async () => {
    const { dom, onopen } = mount({
      body: `see [Arthur](character:${arthur.id})`,
      editable: false,
      known: [arthur],
    });
    await fireEvent.click(dom.querySelector<HTMLElement>('[role="link"]')!);
    expect(onopen).toHaveBeenCalledExactlyOnceWith(arthur.id);
  });

  it("shows the name the character has now, not the one written in the link", () => {
    const renamed = { ...arthur, name: "King Arthur" };
    const { dom } = mount({
      body: `[Arthur](character:${arthur.id})`,
      editable: false,
      known: [renamed],
    });
    expect(dom.querySelector('[role="link"]')!.textContent).toContain("King Arthur");
  });

  it("doesn't open a character from the chip while editing", async () => {
    const { dom, onopen } = mount({
      body: `[Arthur](character:${arthur.id})`,
      editable: true,
      known: [arthur],
    });
    await fireEvent.click(dom.querySelector<HTMLElement>('[role="link"]')!);
    expect(onopen).not.toHaveBeenCalled();
  });

  it("shows a deleted character's label struck through", () => {
    const { dom } = mount({
      body: `[Arthur](character:${arthur.id})`,
      editable: false,
      known: [],
    });
    expect(dom.querySelector("s")!.textContent).toBe("Arthur");
    expect(dom.querySelector('[role="link"]')).toBeNull();
  });

  it("styles a web link and opens it in view mode only", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { dom } = mount({ body: "[a page](https://example.com)", editable: false });
    const link = dom.querySelector<HTMLElement>(".cm-dp-link")!;
    expect(link.textContent).toBe("a page");
    await fireEvent.click(link);
    expect(open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener");
    open.mockRestore();
  });
});

describe("NotesEditor right-click menu", () => {
  // jsdom has no layout, so it would answer "the end of the text" and collapse the selection.
  beforeEach(() => {
    vi.spyOn(EditorView.prototype, "posAtCoords").mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens, drawn by the app, while editing", async () => {
    const { dom } = mount({ body: "hello" });
    const allowed = await rightClick(dom);
    expect(allowed).toBe(false); // the browser's own menu was prevented
    expect(menuSearch()).not.toBeNull();
  });

  it("leaves Shift+right-click to the system menu, which has the spelling suggestions", async () => {
    const { dom } = mount({ body: "hello" });
    const allowed = await rightClick(dom, { shiftKey: true });
    expect(allowed).toBe(true);
    expect(menuSearch()).toBeNull();
  });

  it("is not drawn in view mode", async () => {
    const { dom } = mount({ body: "hello", editable: false });
    expect(await rightClick(dom)).toBe(true);
    expect(menuSearch()).toBeNull();
  });

  it("turns the block under the cursor into another", async () => {
    const { dom, editor } = mount({ body: "hello" });
    editor.dispatch({ selection: { anchor: 2 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Turn into" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Heading 2" }));
    expect(editor.state.doc.toString()).toBe("## hello");
    expect(menuSearch()).toBeNull();
  });

  it("formats the selection, with formatting only offered when there is one", async () => {
    const { dom, editor } = mount({ body: "hello" });
    await rightClick(dom);
    expect(screen.queryByRole("menuitem", { name: "Bold" })).toBeNull();
    await fireEvent.keyDown(menuSearch()!, { key: "Escape" });
    editor.dispatch({ selection: { anchor: 0, head: 5 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Bold" }));
    expect(editor.state.doc.toString()).toBe("**hello**");
  });

  it("deletes the block under the cursor", async () => {
    const { dom, editor, onchange } = mount({ body: "first\n\nsecond" });
    editor.dispatch({ selection: { anchor: 8 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete block" }));
    expect(editor.state.doc.toString()).toBe("first\n");
    expect(onchange).toHaveBeenLastCalledWith("first\n");
  });

  it("adds a link to the selection from the Link… popover", async () => {
    const { dom, editor } = mount({ body: "hello" });
    editor.dispatch({ selection: { anchor: 0, head: 5 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Link…" }));
    await fireEvent.input(screen.getByRole("textbox", { name: "Link address" }), {
      target: { value: "https://example.com" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(editor.state.doc.toString()).toBe("[hello](https://example.com)");
  });

  it("refuses a link to something other than the web or an email address", async () => {
    const { dom, editor } = mount({ body: "hello" });
    editor.dispatch({ selection: { anchor: 0, head: 5 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Link…" }));
    await fireEvent.input(screen.getByRole("textbox", { name: "Link address" }), {
      target: { value: "javascript:alert(1)" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByText("Use a link starting with https://, http:// or mailto:")).toBeTruthy();
    expect(editor.state.doc.toString()).toBe("hello");
  });

  it("cuts, copies and pastes through the clipboard", async () => {
    let clipboard = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => Promise.resolve(void (clipboard = text)),
        readText: () => Promise.resolve(clipboard),
      },
    });
    const { dom, editor } = mount({ body: "hello world" });
    editor.dispatch({ selection: { anchor: 0, head: 5 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    await vi.waitFor(() => expect(editor.state.doc.toString()).toBe(" world"));
    expect(clipboard).toBe("hello");
    editor.dispatch({ selection: { anchor: 6 } });
    await rightClick(dom);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    await vi.waitFor(() => expect(editor.state.doc.toString()).toBe(" worldhello"));
  });
});
