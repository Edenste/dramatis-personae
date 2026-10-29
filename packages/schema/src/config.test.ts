import { describe, expect, it } from "vitest";
import { AppStateFileSchema, OptionsFileSchema, WorkspaceFileSchema } from "./config.ts";

describe("OptionsFileSchema", () => {
  it("fills in the defaults", () => {
    expect(OptionsFileSchema.parse({})).toEqual({
      theme: "system",
      port: 30300,
      listenAddress: "127.0.0.1",
    });
  });

  it("rejects a port out of range", () => {
    expect(OptionsFileSchema.safeParse({ port: 70000 }).success).toBe(false);
  });

  it("keeps unknown keys", () => {
    expect(OptionsFileSchema.parse({ extra: 1 })).toMatchObject({ extra: 1 });
  });
});

describe("WorkspaceFileSchema", () => {
  it("fills in the defaults", () => {
    expect(WorkspaceFileSchema.parse({})).toEqual({
      tabs: [],
      activeTab: null,
      recentCharacters: [],
      cards: {},
    });
  });

  const card = { character: "pm6i0t9upq3sgptb", x: 24, y: 16, width: 280, height: 220 };

  it("keeps at most 50 cards per tab", () => {
    const cards = Array.from({ length: 51 }, () => card);
    expect(WorkspaceFileSchema.safeParse({ cards: { graph: cards } }).success).toBe(false);
    expect(WorkspaceFileSchema.safeParse({ cards: { graph: cards.slice(1) } }).success).toBe(true);
  });

  it("rejects a card with no width", () => {
    expect(
      WorkspaceFileSchema.safeParse({ cards: { graph: [{ ...card, width: 0 }] } }).success,
    ).toBe(false);
  });

  it("keeps at most 20 recent characters", () => {
    const recentCharacters = Array.from(
      { length: 21 },
      (_, i) => `kay${String(i).padStart(13, "0")}`,
    );
    expect(WorkspaceFileSchema.safeParse({ recentCharacters }).success).toBe(false);
    expect(
      WorkspaceFileSchema.safeParse({ recentCharacters: recentCharacters.slice(1) }).success,
    ).toBe(true);
  });
});

describe("AppStateFileSchema", () => {
  it("fills in the defaults", () => {
    expect(AppStateFileSchema.parse({})).toEqual({ lastWorld: null });
  });
});
