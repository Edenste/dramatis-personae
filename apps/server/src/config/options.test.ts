import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OptionsFileSchema } from "@dramatis-personae/schema";
import { tempDataRoot, type TempDataRoot } from "@dramatis-personae/core/testing";
import { resolveDataPaths } from "./data-root.ts";
import { checkWritable, readOptions, writeOptions } from "./options.ts";

describe("options.json", () => {
  let temp: TempDataRoot;
  let file: string;

  beforeEach(async () => {
    temp = await tempDataRoot();
    file = join(temp.dataRoot, "Config", "options.json");
  });
  afterEach(async () => {
    await temp.cleanup();
  });

  it("gives the defaults when the file is missing", async () => {
    expect(await readOptions(file)).toEqual(OptionsFileSchema.parse({}));
  });

  it("gives the defaults when the file is broken, without throwing", async () => {
    await mkdir(join(temp.dataRoot, "Config"), { recursive: true });
    await writeFile(file, "{ broken");
    expect(await readOptions(file)).toEqual(OptionsFileSchema.parse({}));
  });

  it("round-trips, keeping unknown keys", async () => {
    await writeOptions(file, OptionsFileSchema.parse({ theme: "dark", extra: { a: 1 } }));
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ extra: { a: 1 } });
    expect(await readOptions(file)).toMatchObject({ theme: "dark", extra: { a: 1 } });
  });
});

describe("checkWritable", () => {
  let temp: TempDataRoot;
  beforeEach(async () => {
    temp = await tempDataRoot();
  });
  afterEach(async () => {
    await temp.cleanup();
  });

  const pathsFor = (dataRoot: string) =>
    resolveDataPaths({
      argv: ["--data-path", dataRoot],
      vars: {},
      defaultRoot: temp.dataRoot,
      options: OptionsFileSchema.parse({}),
    });

  it("creates the data root's folders and leaves no probe file", async () => {
    const dataRoot = join(temp.dataRoot, "root");
    expect(await checkWritable(pathsFor(dataRoot))).toEqual({ writable: true });
    for (const sub of [["Data", "worlds"], ["Backups"], ["Logs"], ["Config", "workspaces"]]) {
      expect(existsSync(join(dataRoot, ...sub)), sub.join("/")).toBe(true);
    }
    expect(existsSync(join(dataRoot, "Config", ".write-test"))).toBe(false);
  });

  it("reports a data root that is a file as not writable", async () => {
    const dataRoot = join(temp.dataRoot, "a-file");
    await writeFile(dataRoot, "not a folder");
    const result = await checkWritable(pathsFor(dataRoot));
    expect(result.writable).toBe(false);
    expect(result).toMatchObject({ problem: expect.stringContaining(dataRoot) });
  });
});
