import { describe, expect, it } from "vitest";
import type { CardState } from "@dramatis-personae/schema";
import {
  CARD,
  bringToFront,
  clampCard,
  closeCard,
  moveCard,
  openCard,
  placeNew,
  resizeCard,
} from "./cards.ts";

const bounds = { width: 1000, height: 600 };
const size = { width: 280, height: 220 };
const card = (character: string, x = 100, y = 100): CardState => ({
  character,
  x,
  y,
  width: 280,
  height: 220,
});

describe("placing new cards", () => {
  it("opens the first card 12px from the top-right corner and cascades the rest", () => {
    expect(placeNew(0, bounds, size)).toEqual({ x: 708, y: 12 });
    expect(placeNew(1, bounds, size)).toEqual({ x: 692, y: 28 });
  });

  it("starts again from the corner when the next card would leave the page", () => {
    const tight = { width: 330, height: 280 };
    expect(placeNew(2, tight, size)).toEqual(placeNew(0, tight, size));
    expect(placeNew(1, tight, size)).not.toEqual(placeNew(0, tight, size));
  });
});

describe("keeping cards on the page", () => {
  it("moves a card back inside", () => {
    expect(clampCard({ ...card("kay"), x: 900, y: 500 }, bounds)).toEqual({
      ...card("kay"),
      x: 720,
      y: 380,
    });
  });

  it("shrinks a card to fit, but never below the minimum size", () => {
    expect(clampCard(card("kay"), { width: 200, height: 100 })).toEqual({
      character: "kay",
      x: 0,
      y: 0,
      width: CARD.minWidth,
      height: CARD.minHeight,
    });
  });

  it("stops a dragged card at the edges", () => {
    expect(moveCard(card("kay"), -50, 900, bounds)).toMatchObject({ x: 0, y: 380 });
  });
});

describe("resizing cards", () => {
  it("grows from the bottom-right corner", () => {
    expect(resizeCard(card("kay"), "se", 40, 30, bounds)).toMatchObject({
      x: 100,
      y: 100,
      width: 320,
      height: 250,
    });
  });

  it("grows leftwards from the left edge", () => {
    expect(resizeCard(card("kay"), "w", -50, 0, bounds)).toMatchObject({ x: 50, width: 330 });
  });

  it("stops at the minimum width", () => {
    expect(resizeCard(card("kay"), "w", 100, 0, bounds)).toMatchObject({ x: 140, width: 240 });
  });

  it("stops at the page's edge", () => {
    expect(resizeCard(card("kay"), "e", 2000, 0, bounds)).toMatchObject({ x: 100, width: 900 });
  });
});

describe("the stack of cards", () => {
  const stack = [card("arthur"), card("merlin"), card("kay")];

  it("opens a new card in front", () => {
    const opened = openCard(stack, "gawain", bounds, 220);
    expect(opened.map((c) => c.character)).toEqual(["arthur", "merlin", "kay", "gawain"]);
    expect(opened.at(-1)).toMatchObject(placeNew(3, bounds, size));
  });

  it("brings an open character's card forward instead of opening another", () => {
    const opened = openCard(stack, "arthur", bounds, 220);
    expect(opened.map((c) => c.character)).toEqual(["merlin", "kay", "arthur"]);
    expect(opened.at(-1)).toEqual(stack[0]);
  });

  it("brings forward and closes", () => {
    expect(bringToFront(stack, "merlin").map((c) => c.character)).toEqual([
      "arthur",
      "kay",
      "merlin",
    ]);
    expect(closeCard(stack, "merlin").map((c) => c.character)).toEqual(["arthur", "kay"]);
  });
});
