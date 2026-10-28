import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FOLDERS,
  FILE_SCHEMAS,
  LIBRARY_FILES,
  WORLD_FILE,
  buildWorldJsonSchema,
  schemaRefFor,
  type FileKind,
} from "@dramatis-personae/schema";
import { CAMELOT_IDS, CAMELOT_PATH } from "./index.ts";

function readJson(path: string): { text: string; data: Record<string, unknown> } {
  const text = readFileSync(path, "utf8");
  return { text, data: JSON.parse(text) as Record<string, unknown> };
}

function worldFiles(): Array<{ path: string; kind: FileKind }> {
  const files: Array<{ path: string; kind: FileKind }> = [
    { path: join(CAMELOT_PATH, WORLD_FILE), kind: "world" },
  ];
  for (const [kind, name] of Object.entries(LIBRARY_FILES)) {
    files.push({ path: join(CAMELOT_PATH, name), kind: kind as FileKind });
  }
  for (const [kind, folder] of Object.entries(DOCUMENT_FOLDERS)) {
    const dir = join(CAMELOT_PATH, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      files.push({ path: join(dir, name), kind: kind as FileKind });
    }
  }
  return files;
}

describe("Camelot sample world", () => {
  const files = worldFiles();

  it.each(files.map((f) => [f.path.slice(CAMELOT_PATH.length + 1), f.kind] as const))(
    "%s passes the %s schema",
    (relative, kind) => {
      const { data } = readJson(join(CAMELOT_PATH, relative));
      const result = FILE_SCHEMAS[kind].safeParse(data);
      expect(result.error?.issues ?? []).toEqual([]);
      expect(data.$schema).toBe(schemaRefFor(kind));
    },
  );

  it("formats every file as the app writes it", () => {
    for (const { path } of files) {
      const { text, data } = readJson(path);
      expect(text, path).toBe(JSON.stringify(data, null, 2) + "\n");
    }
  });

  it("has the twelve characters", () => {
    expect(files.filter((f) => f.kind === "character")).toHaveLength(12);
    expect(Object.keys(CAMELOT_IDS.characters)).toHaveLength(12);
  });

  it("has every portrait its characters point to", () => {
    for (const { path, kind } of files) {
      if (kind !== "character") continue;
      const portrait = readJson(path).data.portrait as { file: string } | undefined;
      if (portrait) {
        expect(
          existsSync(join(CAMELOT_PATH, "assets/portraits", portrait.file)),
          portrait.file,
        ).toBe(true);
      }
    }
  });

  it("ships a world.schema.json generated from its fields", () => {
    const fields = FILE_SCHEMAS.fields.parse(readJson(join(CAMELOT_PATH, "fields.json")).data);
    expect(readJson(join(CAMELOT_PATH, "world.schema.json")).data).toEqual(
      buildWorldJsonSchema(fields.fields),
    );
  });
});
