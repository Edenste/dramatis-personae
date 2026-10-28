import * as fsp from "node:fs/promises";

/** The file operations storage uses, so tests can inject failures. */
export interface FileSystem {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  stat(path: string): Promise<{ isDirectory(): boolean; mtimeMs: number }>;
  rm(path: string, options: { recursive?: boolean; force?: boolean }): Promise<void>;
}

export const nodeFileSystem: FileSystem = {
  readFile: (path) => fsp.readFile(path),
  writeFile: (path, data) => fsp.writeFile(path, data),
  rename: (from, to) => fsp.rename(from, to),
  unlink: (path) => fsp.unlink(path),
  readdir: (path) => fsp.readdir(path),
  mkdir: (path, options) => fsp.mkdir(path, options),
  stat: (path) => fsp.stat(path),
  rm: (path, options) => fsp.rm(path, options),
};

export function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
