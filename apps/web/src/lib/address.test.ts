import { describe, expect, it } from "vitest";
import { isTabAddress, locationFor, normaliseTabs, parseLocation } from "./address.ts";

const world = "0v2zt9rkngnagdl3";
const lancelot = "pm6i0t9upq3sgptb";

describe("addresses", () => {
  it("round-trips a tab's location", () => {
    const path = `/w/${world}/character/${lancelot}`;
    const parsed = parseLocation(path);
    expect(parsed).toEqual({ world, tab: `character/${lancelot}` });
    expect(locationFor(parsed!.world, parsed!.tab)).toBe(path);
    expect(parseLocation(`/w/${world}/graph`)).toEqual({ world, tab: "graph" });
    expect(parseLocation(`/w/${world}/problems`)).toEqual({ world, tab: "problems" });
  });

  it.each([
    "/w/x/graph",
    `/w/${world}/settings`,
    `/w/${world}/character/Lancelot`,
    "/elsewhere",
    "/",
  ])("rejects %s", (path) => {
    expect(parseLocation(path)).toBeNull();
  });

  it("recognises tab addresses", () => {
    expect(isTabAddress("dashboard")).toBe(true);
    expect(isTabAddress("fields")).toBe(true);
    expect(isTabAddress(`character/${lancelot}`)).toBe(true);
    expect(isTabAddress("character/")).toBe(false);
    expect(isTabAddress("settings")).toBe(false);
  });

  it("keeps valid tabs once each, with the pinned tabs first", () => {
    expect(normaliseTabs([`character/${lancelot}`, "graph", "bogus", "graph"])).toEqual([
      "graph",
      "dashboard",
      `character/${lancelot}`,
    ]);
    expect(normaliseTabs([])).toEqual(["graph", "dashboard"]);
  });
});
