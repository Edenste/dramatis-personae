import { fireEvent, render, screen } from "@testing-library/svelte";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fromSnapshot } from "../lib/world-mirror.ts";
import type { QuietResult } from "../lib/world-connection.svelte.ts";
import { profileView } from "../profile/profile-view.ts";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot, withData } from "../test-utils/fixtures.ts";
import NotesSectionHarness from "../test-utils/NotesSectionHarness.svelte";
import NotesSection from "./NotesSection.svelte";

const KEY = `character:${IDS.lancelot}`;

function stateWith(body: string, fingerprint?: string) {
  const snapshot = profileSnapshot();
  snapshot.files = snapshot.files.map((f) =>
    f.ref.kind === "character" && f.ref.id === IDS.lancelot
      ? { ...withData(f, { body }), ...(fingerprint ? { fingerprint } : {}) }
      : f,
  );
  return fromSnapshot(snapshot);
}

function mount(
  options: {
    body?: string;
    editable?: boolean;
    canEdit?: boolean;
    runQuiet?: () => Promise<QuietResult>;
  } = {},
) {
  const state = stateWith(options.body ?? "start");
  const fake = fakeActions({
    canEdit: options.canEdit ?? true,
    ...(options.runQuiet ? { runQuiet: options.runQuiet } : {}),
  });
  const rendered = render(NotesSection, {
    view: profileView(state, IDS.lancelot)!,
    state,
    editable: options.editable ?? true,
    actions: fake.actions,
  });
  const dom = rendered.container.querySelector<HTMLElement>(".cm-editor")!;
  return { ...rendered, ...fake, dom, editor: EditorView.findFromDOM(dom)! };
}

const type = (editor: EditorView, text: string) =>
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
    userEvent: "input.type",
  });

const bodiesSent = (batches: Array<{ commands: unknown[] }>) =>
  batches.map((b) => (b.commands[0] as { set: { body: string } }).set.body);

afterEach(() => vi.useRealTimers());

describe("NotesSection saving", () => {
  it("saves 800 ms after typing stops, expecting the fingerprint it last saw", async () => {
    vi.useFakeTimers();
    const { editor, batches } = mount();
    type(editor, "new notes");
    await vi.advanceTimersByTimeAsync(799);
    expect(batches).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.commands[0]).toMatchObject({
      type: "character.update",
      id: IDS.lancelot,
      set: { body: "new notes" },
    });
    expect(Object.keys(batches[0]!.expect ?? {})).toEqual([KEY]);
  });

  // Review focus 2: closing the tab or card inside the pause.
  it("saves what was just typed when the notes are closed before the pause is over", () => {
    const { editor, batches, unmount } = mount();
    type(editor, "last words");
    unmount();
    expect(bodiesSent(batches)).toEqual(["last words"]);
  });

  it("saves when the editor is left", async () => {
    const { editor, dom, batches } = mount();
    type(editor, "left early");
    await fireEvent.blur(dom.querySelector(".cm-content")!);
    expect(bodiesSent(batches)).toEqual(["left early"]);
  });

  it("saves, in a request that outlives the page, when the page is hidden", () => {
    const { editor, batches, quietOptions } = mount();
    type(editor, "closing the window");
    window.dispatchEvent(new Event("pagehide"));
    expect(bodiesSent(batches)).toEqual(["closing the window"]);
    expect(quietOptions[0]).toEqual({ keepalive: true });
  });

  it("saves nothing when nothing was typed", async () => {
    vi.useFakeTimers();
    const { batches, unmount } = mount();
    await vi.advanceTimersByTimeAsync(2000);
    unmount();
    expect(batches).toEqual([]);
  });

  it("saves a to-do ticked in view mode", async () => {
    vi.useFakeTimers();
    const { dom, batches } = mount({ body: "- [ ] polish the sword", editable: false });
    await fireEvent.click(dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await vi.advanceTimersByTimeAsync(800);
    expect(bodiesSent(batches)).toEqual(["- [x] polish the sword"]);
  });

  it("won't let someone who can't edit tick a to-do", () => {
    const { dom } = mount({ body: "- [ ] polish the sword", editable: false, canEdit: false });
    expect(dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
  });
});

// Review focus 5: the same character open in two places.
describe("NotesSection and changes from outside", () => {
  it("shows a new body when nothing is unsaved", async () => {
    const first = mount({ body: "start" });
    const changed = stateWith("changed elsewhere", "f".repeat(64));
    await first.rerender({
      view: profileView(changed, IDS.lancelot)!,
      state: changed,
      editable: true,
      actions: first.actions,
    });
    expect(first.editor.state.doc.toString()).toBe("changed elsewhere");
  });

  it("leaves unsaved typing alone when the file changes", async () => {
    const first = mount({ body: "start" });
    type(first.editor, "my typing");
    const changed = stateWith("changed elsewhere", "f".repeat(64));
    await first.rerender({
      view: profileView(changed, IDS.lancelot)!,
      state: changed,
      editable: true,
      actions: first.actions,
    });
    expect(first.editor.state.doc.toString()).toBe("my typing");
  });
});

describe("NotesSection and character links", () => {
  const link = `[Arthur](character:${IDS.arthur})`;

  /** Lancelot's notes link to Arthur; Arthur is renamed or removed, or left alone. */
  const world = (change: "none" | "rename" | "delete") => {
    const snapshot = profileSnapshot();
    snapshot.files = snapshot.files
      .filter(
        (f) => !(change === "delete" && f.ref.kind === "character" && f.ref.id === IDS.arthur),
      )
      .map((f) => {
        if (f.ref.kind !== "character") return f;
        if (f.ref.id === IDS.lancelot) return withData(f, { body: link });
        if (f.ref.id === IDS.arthur && change === "rename")
          return withData(f, { name: "King Arthur" });
        return f;
      });
    return fromSnapshot(snapshot);
  };

  /** Shows the notes, then swaps the world the way a live update would. */
  async function afterChange(change: "rename" | "delete") {
    const { actions } = fakeActions();
    const view = render(NotesSectionHarness, {
      first: world("none"),
      next: world(change),
      id: IDS.lancelot,
      actions,
    });
    expect(view.container.querySelector('[role="link"]')!.textContent).toContain("Arthur");
    await fireEvent.click(screen.getByRole("button", { name: "Change world" }));
    return view.container;
  }

  it("shows a renamed character's new name without being reopened", async () => {
    const container = await afterChange("rename");
    expect(container.querySelector('[role="link"]')!.textContent).toContain("King Arthur");
  });

  it("strikes through the link of a character who is deleted", async () => {
    const container = await afterChange("delete");
    expect(container.querySelector('[role="link"]')).toBeNull();
    expect(container.querySelector("s")!.textContent).toBe("Arthur");
  });
});
describe("NotesSection conflicts", () => {
  const conflict = () => Promise.resolve<QuietResult>({ ok: false, conflict: true });
  beforeEach(() => vi.useRealTimers());

  async function conflicted() {
    const runQuiet = vi.fn(conflict);
    const section = mount({ runQuiet });
    type(section.editor, "my version");
    await fireEvent.blur(section.dom.querySelector(".cm-content")!);
    await screen.findByRole("heading", { name: "These notes changed outside the app" });
    return { ...section, runQuiet };
  }

  it("asks whether to keep mine or take theirs", async () => {
    await conflicted();
    expect(screen.getByText("Keep your version, or take the version on disk?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep mine" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take theirs" })).toBeTruthy();
  });

  it("keep mine saves again, overwriting", async () => {
    const { runQuiet } = await conflicted();
    runQuiet.mockImplementation(() =>
      Promise.resolve<QuietResult>({
        ok: true,
        result: { inverse: { commands: [] }, fingerprints: { [KEY]: "9".repeat(64) } },
      }),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    await vi.waitFor(() => expect(runQuiet).toHaveBeenCalledTimes(2));
    const second = (runQuiet.mock.calls as unknown as Array<[{ expect?: object }]>)[1]![0];
    expect(second.expect).toBeUndefined();
    expect(screen.queryByRole("heading", { name: /changed outside/ })).toBeNull();
  });

  it("take theirs puts the other version in the editor", async () => {
    const { editor } = await conflicted();
    await fireEvent.click(screen.getByRole("button", { name: "Take theirs" }));
    expect(editor.state.doc.toString()).toBe("start");
    expect(screen.queryByRole("heading", { name: /changed outside/ })).toBeNull();
  });
});
