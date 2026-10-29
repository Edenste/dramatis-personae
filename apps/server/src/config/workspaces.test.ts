import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDataRoot, type TempDataRoot } from "@dramatis-personae/core/testing";
import { readWorkspace, writeWorkspace } from "./workspaces.ts";

const world = "0v2zt9rkngnagdl3";
const defaults = { tabs: [], activeTab: null, recentCharacters: [], cards: {} };

describe("workspace files", () => {
  let temp: TempDataRoot;
  let dir: string;

  beforeEach(async () => {
    temp = await tempDataRoot();
    dir = join(temp.dataRoot, "Config", "workspaces");
  });
  afterEach(async () => {
    await temp.cleanup();
  });

  it("gives the defaults for a world with no workspace yet", async () => {
    expect(await readWorkspace(dir, world)).toEqual(defaults);
  });

  it("round-trips a workspace", async () => {
    const workspace = {
      tabs: ["graph", "dashboard", "character/2mxafd1whkfr51wp"],
      activeTab: "graph",
      recentCharacters: ["2mxafd1whkfr51wp"],
      cards: {},
    };
    await writeWorkspace(dir, world, workspace);
    expect(await readWorkspace(dir, world)).toEqual(workspace);
  });

  it("gives the defaults for an invalid file", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${world}.json`), JSON.stringify({ tabs: "graph" }));
    expect(await readWorkspace(dir, world)).toEqual(defaults);
  });
});
