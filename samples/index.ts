import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const worldsDir = join(dirname(fileURLToPath(import.meta.url)), "worlds");
const folder = readdirSync(worldsDir).find((name) => name.startsWith("camelot-"));
if (!folder) throw new Error(`No Camelot sample world in ${worldsDir}`);

/** Absolute path to the Camelot sample world folder. */
export const CAMELOT_PATH = join(worldsDir, folder);

type Named = { id: string; name?: string; title?: string };

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(join(CAMELOT_PATH, relative), "utf8")) as T;
}

function byName(items: Named[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.name ?? item.title ?? item.id, item.id]));
}

function folderDocs(name: string): Named[] {
  return readdirSync(join(CAMELOT_PATH, name)).map((file) => readJson<Named>(`${name}/${file}`));
}

/** Ids in the sample world, looked up by name, for tests. */
export const CAMELOT_IDS = {
  world: readJson<{ id: string }>("world.json").id,
  characters: byName(folderDocs("characters")),
  events: byName(folderDocs("events")),
  views: byName(folderDocs("views")),
  roles: byName(readJson<{ roles: Named[] }>("roles.json").roles),
  relationshipTypes: byName(readJson<{ types: Named[] }>("relationship-types.json").types),
  templates: byName(readJson<{ templates: Named[] }>("templates.json").templates),
};
