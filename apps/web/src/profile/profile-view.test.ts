import { describe, expect, it } from "vitest";
import { IDS, profileSnapshot, snapshot, withData } from "../test-utils/fixtures.ts";
import { fromSnapshot, type WorldState } from "../lib/world-mirror.ts";
import { profileView } from "./profile-view.ts";

const stateOf = (build = profileSnapshot) => fromSnapshot(build());

describe("profileView", () => {
  it("lists the shown fields in library order with their source and value", () => {
    const view = profileView(stateOf(), IDS.lancelot)!;
    expect(view.rows.map((r) => [r.field.key, r.source, r.template, r.value])).toEqual([
      ["birthday", "default", undefined, { calendar: "gregorian", month: 8, day: 15 }],
      ["title", "default", undefined, "Knight of the Round Table"],
      ["weapon", "template", "Knight", "Arondight"],
      ["steed", "template", "Knight", undefined],
    ]);
  });

  it("shows a one-off field on the character that has it", () => {
    const view = profileView(stateOf(), IDS.merlin)!;
    expect(view.rows.map((r) => [r.field.key, r.source])).toEqual([
      ["birthday", "default"],
      ["title", "default"],
      ["bloodType", "extra"],
    ]);
  });

  it("takes the subtitle from the world's subtitle field", () => {
    expect(profileView(stateOf(), IDS.lancelot)!.subtitle).toBe("Knight of the Round Table");
    expect(profileView(stateOf(), IDS.arthur)!.subtitle).toBeNull();
  });

  it("gives the colour and where it came from", () => {
    const lancelot = profileView(stateOf(), IDS.lancelot)!;
    expect(lancelot.color).toBe("#3b6fd4");
    expect(lancelot.colorReason).toBe("From Knights of the Round Table");
    expect(profileView(stateOf(), IDS.arthur)!.colorReason).toBe("Default grey");

    const chosen = profileSnapshot();
    chosen.files = chosen.files.map((f) =>
      f.ref.kind === "character" && f.ref.id === IDS.lancelot
        ? withData(f, { color: "#ff3b30" })
        : f,
    );
    const view = profileView(fromSnapshot(chosen), IDS.lancelot)!;
    expect([view.color, view.colorReason]).toEqual(["#ff3b30", "Chosen for this character"]);
  });

  it("lists the roles, the templates held and the ones not held", () => {
    const view = profileView(stateOf(), IDS.lancelot)!;
    expect(view.roles).toEqual([
      { id: IDS.knights, name: "Knights of the Round Table", color: "#3b6fd4" },
    ]);
    expect(view.templates.map((t) => t.name)).toEqual(["Knight"]);
    expect(view.otherTemplates).toEqual([]);
    expect(profileView(stateOf(), IDS.arthur)!.otherTemplates.map((t) => t.name)).toEqual([
      "Knight",
    ]);
  });

  it("lists the library fields the character doesn't show", () => {
    const view = profileView(stateOf(), IDS.lancelot)!;
    expect(view.unshownFields.map((f) => f.key)).toEqual(["liege", "bloodType"]);
  });

  it("is blocked while the character's file is invalid on disk", () => {
    const state: WorldState = stateOf();
    const path = state.files.get(`character:${IDS.lancelot}`)!.path;
    expect(profileView(state, IDS.lancelot)!.blocked).toBe(false);
    const broken = { ...state, problems: [{ code: "invalid-json" as const, path, message: "x" }] };
    expect(profileView(broken, IDS.lancelot)!.blocked).toBe(true);
    expect(profileView(broken, IDS.arthur)!.blocked).toBe(false);
  });

  it("works in a world with no field library", () => {
    const view = profileView(fromSnapshot(snapshot()), IDS.arthur)!;
    expect(view.rows).toEqual([]);
    expect(view.subtitle).toBeNull();
  });

  it("is null for a character that doesn't exist", () => {
    expect(profileView(stateOf(), "zzzzzzzzzzzzzzzz")).toBeNull();
  });

  it("carries the fingerprint of the character's file", () => {
    const state = stateOf();
    expect(profileView(state, IDS.lancelot)!.fingerprint).toBe(
      state.files.get(`character:${IDS.lancelot}`)!.fingerprint,
    );
  });
});
