import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { CardState } from "@dramatis-personae/schema";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot, withData } from "../test-utils/fixtures.ts";
import { fromSnapshot } from "../lib/world-mirror.ts";
import CardLayer from "./CardLayer.svelte";

const bounds = { width: 1000, height: 600 };
const state = fromSnapshot(profileSnapshot());
const card = (character: string, x: number, y: number): CardState => ({
  character,
  x,
  y,
  width: 280,
  height: 220,
});
const stored = [card(IDS.merlin, 20, 20), card(IDS.lancelot, 400, 60)];

function setup(overrides: Record<string, unknown> = {}, actionOverrides = {}) {
  const fake = fakeActions(actionOverrides);
  const handlers = { oncards: vi.fn(), onopentab: vi.fn() };
  const view = render(CardLayer, {
    cards: stored,
    state,
    bounds,
    actions: fake.actions,
    ...handlers,
    ...overrides,
  });
  return { ...handlers, ...fake, ...view };
}

const dialog = (name: string) => screen.getByRole("dialog", { name });

describe("CardLayer", () => {
  it("puts the last stored card in front: higher up the stack and first in the document", () => {
    setup();
    const [first, second] = [dialog("Lancelot"), dialog("Merlin")];
    expect(Number(first.parentElement!.style.zIndex)).toBeGreaterThan(
      Number(second.parentElement!.style.zIndex),
    );
    const all = screen.getAllByRole("dialog");
    expect(all[0]).toBe(first);
  });

  it("brings a card forward when pressed", async () => {
    const { oncards } = setup();
    await fireEvent.pointerDown(dialog("Merlin"));
    const next = oncards.mock.calls.at(-1)![0] as CardState[];
    expect(next.map((c) => c.character)).toEqual([IDS.lancelot, IDS.merlin]);
  });

  it("closes a card", async () => {
    const { oncards } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Close Merlin" }));
    expect((oncards.mock.calls.at(-1)![0] as CardState[]).map((c) => c.character)).toEqual([
      IDS.lancelot,
    ]);
  });

  it("opens the character as a tab and closes the card", async () => {
    const { oncards, onopentab } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Open Lancelot as a tab" }));
    expect(onopentab).toHaveBeenCalledWith(IDS.lancelot);
    expect((oncards.mock.calls.at(-1)![0] as CardState[]).map((c) => c.character)).toEqual([
      IDS.merlin,
    ]);
  });

  it("shows the character's profile", () => {
    setup();
    expect(screen.getByText("Arondight")).toBeTruthy();
    expect(screen.getByText("15 August")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edits the profile: the pencil becomes Done, and a changed name is saved", async () => {
    const { batches } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Edit Lancelot" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    // Empty fields appear while editing.
    expect(screen.getByRole("textbox", { name: "Steed" })).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Name" });
    await fireEvent.input(field, { target: { value: "Sir Lancelot" } });
    await fireEvent.keyDown(field, { key: "Enter" });
    expect(batches).toEqual([
      {
        commands: [{ type: "character.update", id: IDS.lancelot, set: { name: "Sir Lancelot" } }],
      },
    ]);
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("doesn't save an empty or unchanged name", async () => {
    const { batches } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Edit Lancelot" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    await fireEvent.input(field, { target: { value: "  " } });
    await fireEvent.keyDown(field, { key: "Enter" });
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(batches).toEqual([]);
  });

  it("leaves out the templates and notes controls on a card", async () => {
    setup();
    await fireEvent.click(screen.getByRole("button", { name: "Edit Lancelot" }));
    expect(screen.queryByRole("button", { name: "Remove the Knight template" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add a field" })).toBeTruthy();
  });

  it("offers no editing to someone who can't edit", () => {
    setup({}, { canEdit: false });
    expect(screen.queryByRole("button", { name: "Edit Lancelot" })).toBeNull();
  });

  it("opens a character from a link in a card through the actions", async () => {
    const snapshot = profileSnapshot();
    snapshot.files = snapshot.files.map((file) =>
      file.ref.kind === "character" && file.ref.id === IDS.lancelot
        ? withData(file, {
            extraFields: ["liege"],
            fields: { ...(file.data as { fields: object }).fields, liege: IDS.arthur },
          })
        : file,
    );
    const { opened } = setup({ state: fromSnapshot(snapshot) });
    await fireEvent.click(screen.getByRole("link", { name: "Open Arthur" }));
    expect(opened).toEqual([IDS.arthur]);
  });

  it("drops the card of a character that no longer exists", () => {
    const { oncards } = setup({ cards: [...stored, card("goneworldxxxxxxx", 50, 50)] });
    expect((oncards.mock.calls.at(-1)![0] as CardState[]).map((c) => c.character)).toEqual([
      IDS.merlin,
      IDS.lancelot,
    ]);
  });

  it("shows a stored card that is off the page back inside, without rewriting where it was", () => {
    const { oncards } = setup({ cards: [card(IDS.merlin, 2000, 50)] });
    expect(dialog("Merlin").parentElement!.style.left).toBe("720px");
    expect(oncards).not.toHaveBeenCalled();
  });

  it("moves a card from where it is shown when dragged on a smaller page", async () => {
    const { oncards } = setup({ cards: [card(IDS.merlin, 2000, 50)] });
    const strip = dialog("Merlin").querySelector(".strip")!;
    await fireEvent.pointerDown(strip, { clientX: 700, clientY: 60 });
    await fireEvent.pointerMove(window, { clientX: 690, clientY: 60 });
    const moved = (oncards.mock.calls.at(-1)![0] as CardState[])[0]!;
    expect(moved.x).toBe(710);
  });

  it("leaves the cards alone until the page has been measured", () => {
    const { oncards } = setup({ bounds: { width: 0, height: 0 } });
    expect(oncards).not.toHaveBeenCalled();
  });
});
