import {
  CURRENT_SCHEMA_VERSION,
  FILE_SCHEMAS,
  FieldsFileSchema,
  LIBRARY_FILES,
  WORLD_FILE,
  buildWorldJsonSchema,
  type Problem,
} from "@dramatis-personae/schema";
import {
  MIGRATIONS,
  MigrationError,
  type MigratableFile,
  type Migration,
} from "./migrations/migrations.ts";
import { WorldModel } from "./model/world-model.ts";
import { serialize } from "./serialize.ts";
import { kindForPath } from "./storage/json-files/paths.ts";
import type { RawFile, WorldStorage } from "./storage/types.ts";

/** Drops a leading UTF-8 byte-order mark, which JSON.parse rejects. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface OpenWorldOptions {
  migrations?: Migration[];
  currentVersion?: number;
}

function parseRaw(files: RawFile[], version: number, target: number): MigratableFile[] {
  const parsed: MigratableFile[] = [];
  const problems: Problem[] = [];
  for (const file of files) {
    try {
      parsed.push({ path: file.path, data: JSON.parse(stripBom(file.text)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      problems.push({ code: "invalid-json", path: file.path, message });
    }
  }
  if (problems.length > 0) {
    throw new MigrationError(
      version,
      target,
      problems,
      "Some files couldn't be read for upgrading",
    );
  }
  return parsed;
}

function migrate(files: MigratableFile[], migrations: Migration[], from: number, to: number) {
  let current = files;
  for (let version = from; version < to; version++) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new MigrationError(from, to, [], `No way to upgrade from version ${version}`);
    current = step.migrate(current);
  }
  return current.map((file) =>
    file.path === WORLD_FILE
      ? { path: file.path, data: { ...(file.data as object), schemaVersion: to } }
      : file,
  );
}

function validate(files: MigratableFile[], from: number, to: number): void {
  const problems: Problem[] = [];
  for (const file of files) {
    const kind = kindForPath(file.path);
    if (!kind) continue;
    const result = FILE_SCHEMAS[kind].safeParse(file.data);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(file)"}: ${issue.message}`)
        .join("; ");
      problems.push({ code: "invalid-document", path: file.path, message });
    }
  }
  if (problems.length > 0) {
    throw new MigrationError(
      from,
      to,
      problems,
      `Upgrading from version ${from} produced invalid files`,
    );
  }
}

/**
 * Opens a world (spec §8). An older world is backed up, migrated in memory,
 * validated and only then written; a newer one opens read-only.
 */
export async function openWorld(
  storage: WorldStorage,
  worldId: string,
  options: OpenWorldOptions = {},
): Promise<{ model: WorldModel; readOnly: boolean }> {
  const target = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  const version = (await storage.listWorlds()).find((w) => w.id === worldId)?.schemaVersion;

  if (typeof version === "number" && version > target) {
    return { model: WorldModel.fromLoaded(await storage.loadWorld(worldId)), readOnly: true };
  }

  if (typeof version === "number" && version < target) {
    const raw = await storage.loadRaw(worldId);
    await storage.backup(worldId);
    const migrated = migrate(
      parseRaw(raw, version, target),
      options.migrations ?? MIGRATIONS,
      version,
      target,
    );
    validate(migrated, version, target);
    const fields = migrated.find((f) => f.path === LIBRARY_FILES.fields)?.data;
    const schema = buildWorldJsonSchema(FieldsFileSchema.safeParse(fields).data?.fields ?? []);
    const text = (file: MigratableFile) => ({ path: file.path, text: serialize(file.data) });
    // world.json goes last: if any other write fails, the world still says it's
    // at the old version and is migrated again next time.
    await storage.writeRaw(worldId, [
      ...migrated.filter((f) => f.path !== WORLD_FILE).map(text),
      { path: "world.schema.json", text: serialize(schema) },
      ...migrated.filter((f) => f.path === WORLD_FILE).map(text),
    ]);
  }

  return { model: WorldModel.fromLoaded(await storage.loadWorld(worldId)), readOnly: false };
}
