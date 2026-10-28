export type StorageErrorCode = "locked" | "not-loaded" | "not-found" | "io";

export class StorageError extends Error {
  override readonly name = "StorageError";

  constructor(
    readonly code: StorageErrorCode,
    readonly path: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
