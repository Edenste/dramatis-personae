import {
  refKey,
  resolveCharacterColor,
  type CharacterFile,
  type FileEntry,
  type Problem,
  type RolesFile,
  type ServerMessage,
  type WorldSnapshot,
  type WorldSummary,
} from "@dramatis-personae/schema";

/** The client's copy of one open world. Replaced, never mutated, on every change. */
export interface WorldState {
  world: WorldSummary;
  readOnly: boolean;
  unsaved: { message: string } | null;
  /** By ref key ("world", "roles", "character:<id>"). */
  files: ReadonlyMap<string, FileEntry>;
  problems: Problem[];
  seq: number;
}

export interface CharacterSummary {
  id: string;
  name: string;
  color: string;
}

export function fromSnapshot(snapshot: WorldSnapshot): WorldState {
  return {
    world: snapshot.world,
    readOnly: snapshot.readOnly,
    unsaved: snapshot.unsaved,
    files: new Map(snapshot.files.map((file) => [refKey(file.ref), file])),
    problems: snapshot.problems,
    seq: snapshot.seq,
  };
}

/** Applies a push; anything not newer than the state is ignored. */
export function applyMessage(state: WorldState, message: ServerMessage): WorldState | "reload" {
  if (message.seq <= state.seq) return state;
  const next = { ...state, seq: message.seq };
  switch (message.type) {
    case "changed": {
      const files = new Map(state.files);
      for (const file of message.files) files.set(refKey(file.ref), file);
      for (const key of message.removed) files.delete(key);
      return { ...next, files };
    }
    case "problems":
      return { ...next, problems: message.problems };
    case "save-state":
      return {
        ...next,
        unsaved: message.unsaved
          ? { message: message.message ?? "A change isn't saved yet." }
          : null,
      };
    case "conflict":
      return next; // the client hears about its own conflicts in the reply
    case "reload":
      return "reload";
  }
}

const roles = (state: WorldState) =>
  (state.files.get("roles")?.data as RolesFile | undefined)?.roles ?? [];

function summarise(state: WorldState, file: FileEntry): CharacterSummary {
  const character = file.data as CharacterFile;
  return {
    id: character.id,
    name: character.name,
    color: resolveCharacterColor(character, roles(state)),
  };
}

export function characterList(state: WorldState): CharacterSummary[] {
  return [...state.files.values()]
    .filter((file) => file.ref.kind === "character")
    .map((file) => summarise(state, file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function characterById(state: WorldState, id: string): CharacterSummary | null {
  const file = state.files.get(`character:${id}`);
  return file ? summarise(state, file) : null;
}

export function worldName(state: WorldState): string {
  const world = state.files.get("world")?.data as { name?: string } | undefined;
  return world?.name ?? state.world.name;
}
