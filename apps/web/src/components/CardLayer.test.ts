import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { CardState } from "@dramatis-personae/schema";
import { IDS, snapshot } from "../test-utils/fixtures.ts";
import { fromSnapshot } from "../lib/world-mirror.ts";
import CardLayer from "./CardLayer.svelte";

const bounds = { width: 1000, height: 600 };
const state = fromSnapshot(snapshot());
const card = (character: string, x: number, y: number): CardState => ({
  character,
  x,
  y,
  width: 280,
  height: 220,
});
const stored = [card(IDS.merlin, 20, 20), card(IDS.lancelot, 400, 60)];

function setup(overrides: Record<string, unknown> = {}) {
  const handlers = { oncards: vi.fn(), onopentab: vi.fn(), onrename: vi.fn() };
  const view = render(CardLayer, {
    cards: stored,
    state,
    readOnly: false,
    bounds,
    ...handlers,
    ...overrides,
  });
  return { ...handlers, ...view };
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

  it("edits the name: the pencil becomes Done, and Enter saves", async () => {
    const { onrename } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Edit Lancelot" }));
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Name" });
    await fireEvent.input(field, { target: { value: "Sir Lancelot" } });
    await fireEvent.keyDown(field, { key: "Enter" });
    expect(onrename).toHaveBeenCalledOnce();
    expect(onrename).toHaveBeenCalledWith(IDS.lancelot, "Sir Lancelot");
  });

  it("doesn't save an empty or unchanged name", async () => {
    const { onrename } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Edit Lancelot" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    await fireEvent.input(field, { target: { value: "  " } });
    await fireEvent.keyDown(field, { key: "Enter" });
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onrename).not.toHaveBeenCalled();
  });

  it("offers no editing in a read-only world", () => {
    setup({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Edit Lancelot" })).toBeNull();
  });

  it("drops the card of a character that no longer exists", () => {
    const { oncards } = setup({ cards: [...stored, card("goneworldxxxxxxx", 50, 50)] });
    expect((oncards.mock.calls.at(-1)![0] as CardState[]).map((c) => c.character)).toEqual([
      IDS.merlin,
      IDS.lancelot,
    ]);
  });

  it("pulls a stored card that is off the page back inside", () => {
    const { oncards } = setup({ cards: [card(IDS.merlin, 2000, 50)] });
    expect(oncards.mock.calls.at(-1)![0]).toEqual([card(IDS.merlin, 720, 50)]);
  });

  it("leaves the cards alone until the page has been measured", () => {
    const { oncards } = setup({ bounds: { width: 0, height: 0 } });
    expect(oncards).not.toHaveBeenCalled();
  });
});
