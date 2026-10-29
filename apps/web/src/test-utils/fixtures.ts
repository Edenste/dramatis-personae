import type { FileEntry, WorldSnapshot } from "@dramatis-personae/schema";

export const WORLD = "0v2zt9rkngnagdl3";
export const IDS = {
  arthur: "arthurxxxxxxxxxx",
  merlin: "merlinxxxxxxxxxx",
  lancelot: "lancelotxxxxxxxx",
  knights: "knightsxxxxxxxxx",
};

const fingerprint = (seed: string) => seed.padEnd(64, "0").slice(0, 64);

export function characterFile(id: string, name: string, roles: string[] = []): FileEntry {
  return {
    ref: { kind: "character", id },
    path: `characters/${name.toLowerCase()}-${id}.json`,
    data: { id, name, color: null, roles, templates: [], extraFields: [], fields: {}, body: "" },
    fingerprint: fingerprint(`${id}${name}`),
  };
}

/** A small Camelot: Arthur, Merlin and Lancelot (a Knight of the Round Table). */
export function snapshot(overrides: Partial<WorldSnapshot> = {}): WorldSnapshot {
  return {
    world: { id: WORLD, name: "Camelot", folder: `camelot-${WORLD}`, schemaVersion: 1 },
    readOnly: false,
    unsaved: null,
    problems: [],
    seq: 5,
    files: [
      {
        ref: { kind: "world" },
        path: "world.json",
        data: { id: WORLD, name: "Camelot", schemaVersion: 1, mainView: null },
        fingerprint: fingerprint("world"),
      },
      {
        ref: { kind: "roles" },
        path: "roles.json",
        data: {
          roles: [
            {
              id: IDS.knights,
              name: "Knights of the Round Table",
              kind: "major",
              color: "#3b6fd4",
              leaders: [],
            },
          ],
        },
        fingerprint: fingerprint("roles"),
      },
      characterFile(IDS.arthur, "Arthur"),
      characterFile(IDS.merlin, "Merlin"),
      characterFile(IDS.lancelot, "Lancelot", [IDS.knights]),
    ],
    ...overrides,
  };
}
