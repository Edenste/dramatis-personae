import {
  FILE_SCHEMAS,
  isDocumentKind,
  type FileKind,
  type Problem,
} from "@dramatis-personae/schema";
import { fingerprint } from "../../serialize.ts";

export type ParsedFile =
  | { ok: true; data: Record<string, unknown>; fingerprint: string; missingId: boolean }
  | { ok: false; problem: Problem };

// TextDecoder drops a leading UTF-8 byte-order mark.
const decoder = new TextDecoder("utf-8");

function lineOf(error: unknown, text: string): number | undefined {
  const message = error instanceof Error ? error.message : "";
  const line = /line (\d+)/.exec(message);
  if (line) return Number(line[1]);
  const position = /position (\d+)/.exec(message);
  if (position) return text.slice(0, Number(position[1])).split("\n").length;
  return undefined;
}

/**
 * Parses and validates one file. A document without an `id` is accepted with
 * `missingId: true` so the caller can assign one.
 */
export function parseFile(path: string, kind: FileKind, bytes: Uint8Array): ParsedFile {
  const text = decoder.decode(bytes);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const line = lineOf(error, text);
    return {
      ok: false,
      problem: {
        code: "invalid-json",
        path,
        message: error instanceof Error ? error.message : "Invalid JSON",
        ...(line === undefined ? {} : { line }),
      },
    };
  }

  const missingId =
    isDocumentKind(kind) && typeof json === "object" && json !== null && !("id" in json);
  const candidate = missingId ? { ...(json as object), id: "0000000000000000" } : json;

  const result = FILE_SCHEMAS[kind].safeParse(candidate);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(file)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, problem: { code: "invalid-document", path, message } };
  }
  const data = result.data as Record<string, unknown>;
  if (missingId) delete data.id;
  return { ok: true, data, fingerprint: fingerprint(bytes), missingId };
}
