/** Document, library entry and world IDs: 16 random lowercase letters and digits. */
export const ID_PATTERN = /^[a-z0-9]{16}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 16;
// Largest multiple of 36 that fits in a byte; values at or above it are rejected
// so every character is equally likely.
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

const MAX_SLUG_LENGTH = 60;

export function generateId(): string {
  let id = "";
  const bytes = new Uint8Array(32);
  while (id.length < ID_LENGTH) {
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= UNBIASED_LIMIT) continue;
      id += ALPHABET[byte % ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

export function isId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/**
 * The cosmetic name part of a file name. Lowercase so names never clash on
 * case-insensitive file systems, and capped so paths stay well under Windows limits.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug === "" ? "untitled" : slug;
}

export function documentFileName(name: string, id: string): string {
  return `${slugify(name)}-${id}.json`;
}

export function relationshipFileName(nameA: string, nameB: string, id: string): string {
  return `${slugify(nameA)}-${slugify(nameB)}-${id}.json`;
}

export function worldFolderName(name: string, id: string): string {
  return `${slugify(name)}-${id}`;
}
