import {
  MigrationError,
  StorageError,
  type OpenWorldOptions,
  type WorldStorage,
} from "@dramatis-personae/core";
import type { WorldSummary } from "@dramatis-personae/schema";
import { ApiError } from "../http/errors.ts";
import { WorldSession } from "./world-session.ts";

/** The open worlds. Each is opened once, on first use, and shared. */
export class WorldSessions {
  private readonly sessions = new Map<string, Promise<WorldSession>>();

  constructor(
    private readonly storage: WorldStorage,
    private readonly options?: OpenWorldOptions,
  ) {}

  list(): Promise<WorldSummary[]> {
    return this.storage.listWorlds();
  }

  async create(name: string): Promise<WorldSummary> {
    const id = await this.storage.createWorld({ name });
    return this.summary(id);
  }

  async summary(worldId: string): Promise<WorldSummary> {
    const world = (await this.list()).find((w) => w.id === worldId);
    if (!world) throw new ApiError(404, "not-found", `No world with id ${worldId}`);
    return world;
  }

  get(worldId: string): Promise<WorldSession> {
    let session = this.sessions.get(worldId);
    if (!session) {
      session = this.open(worldId);
      this.sessions.set(worldId, session);
      // A failed open isn't kept, so the next request tries again.
      session.catch(() => this.sessions.delete(worldId));
    }
    return session;
  }

  async closeAll(): Promise<void> {
    const open = [...this.sessions.values()];
    this.sessions.clear();
    for (const session of await Promise.allSettled(open)) {
      if (session.status === "fulfilled") session.value.close();
    }
  }

  private async open(worldId: string): Promise<WorldSession> {
    const world = await this.summary(worldId);
    if (world.problem) throw new ApiError(409, "world-unavailable", world.problem);
    try {
      return await WorldSession.open(this.storage, worldId, this.options);
    } catch (error) {
      if (error instanceof MigrationError) {
        throw new ApiError(409, "migration-failed", error.message, { problems: error.problems });
      }
      if (error instanceof StorageError && error.code !== "locked") {
        throw new ApiError(409, "world-unavailable", error.message);
      }
      throw error;
    }
  }
}
