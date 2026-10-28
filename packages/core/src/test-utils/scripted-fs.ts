import { nodeFileSystem, type FileSystem } from "../storage/fs.ts";

function fsError(code: string): Error {
  return Object.assign(new Error(`${code}: scripted failure`), { code });
}

/**
 * The real file system, recording each write, rename and unlink, with
 * failures that tests can queue up for rename.
 */
export class ScriptedFs implements FileSystem {
  readonly ops: string[] = [];
  /** Error codes thrown by the next renames, one per call. */
  renameFailures: string[] = [];
  /** If set, every rename throws this error code. */
  alwaysFailRename: string | null = null;

  readFile = (path: string) => nodeFileSystem.readFile(path);
  readdir = (path: string) => nodeFileSystem.readdir(path);
  mkdir = (path: string, options: { recursive: true }) => nodeFileSystem.mkdir(path, options);
  stat = (path: string) => nodeFileSystem.stat(path);
  rm = (path: string, options: { recursive?: boolean; force?: boolean }) =>
    nodeFileSystem.rm(path, options);

  writeFile = async (path: string, data: string | Uint8Array) => {
    this.ops.push(`write ${path}`);
    await nodeFileSystem.writeFile(path, data);
  };

  rename = async (from: string, to: string) => {
    const failure = this.alwaysFailRename ?? this.renameFailures.shift();
    if (failure) throw fsError(failure);
    this.ops.push(`rename ${from} -> ${to}`);
    await nodeFileSystem.rename(from, to);
  };

  unlink = async (path: string) => {
    this.ops.push(`unlink ${path}`);
    await nodeFileSystem.unlink(path);
  };
}
