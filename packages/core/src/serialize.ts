import { createHash } from "node:crypto";

/** The exact text every file is written as: two-space JSON, LF, trailing newline. */
export function serialize(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

/** SHA-256 hex digest of a file's bytes (strings are hashed as UTF-8). */
export function fingerprint(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
