import type { Problem } from "@dramatis-personae/schema";

export interface MigratableFile {
  /** World-relative path. */
  path: string;
  data: unknown;
}

/** Upgrades a world's files from one schema version to the next, in memory. */
export interface Migration {
  from: number;
  to: number;
  migrate(files: MigratableFile[]): MigratableFile[];
}

/** Every migration the app knows, oldest first. Empty until the format first changes. */
export const MIGRATIONS: Migration[] = [];

export class MigrationError extends Error {
  override readonly name = "MigrationError";

  constructor(
    readonly fromVersion: number,
    readonly toVersion: number,
    readonly problems: Problem[],
    message: string,
  ) {
    super(message);
  }
}
