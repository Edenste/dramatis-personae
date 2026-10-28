import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLanguageService, TextDocument } from "vscode-json-languageservice";
import { URI, Utils } from "vscode-uri";
import { CAMELOT_PATH } from "./index.ts";

/** Validates a file the way VS Code's JSON extension does, following its `$schema`. */
async function vscodeDiagnostics(path: string): Promise<string[]> {
  const service = getLanguageService({
    schemaRequestService: (uri) => readFile(URI.parse(uri).fsPath, "utf8"),
    workspaceContext: {
      resolveRelativePath: (relative, resource) =>
        Utils.resolvePath(Utils.dirname(URI.parse(resource)), relative).toString(),
    },
  });
  service.configure({ validate: true, allowComments: false });
  const document = TextDocument.create(
    URI.file(path).toString(),
    "json",
    1,
    await readFile(path, "utf8"),
  );
  const diagnostics = await service.doValidation(document, service.parseJSONDocument(document));
  return diagnostics.map((d) => (typeof d.message === "string" ? d.message : d.message.value));
}

describe("editor validation through $schema", () => {
  let dir: string;
  let lancelot: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "dp-vscode-"));
    await cp(CAMELOT_PATH, dir, { recursive: true });
    const name = (await readdir(join(dir, "characters"))).find((n) => n.startsWith("lancelot-"))!;
    lancelot = join(dir, "characters", name);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("accepts the sample file as it is", async () => {
    expect(await vscodeDiagnostics(lancelot)).toEqual([]);
  });

  it("flags a select value outside the field's options", async () => {
    const data = JSON.parse(await readFile(lancelot, "utf8")) as {
      fields: Record<string, unknown>;
    };
    data.fields.bloodType = "Q";
    await writeFile(lancelot, JSON.stringify(data, null, 2) + "\n");
    const messages = await vscodeDiagnostics(lancelot);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"A", "B", "AB", "O"');
  });
});
