import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { openWith } from "./start.ts";

describe("openWith", () => {
  it("rejects, rather than crashing the process, when the opener program is missing", async () => {
    await expect(openWith("dramatis-personae-no-such-opener", tmpdir())).rejects.toThrow(
      /dramatis-personae-no-such-opener/,
    );
  });

  it("resolves once the opener has started", async () => {
    // node is certain to exist; with a file argument it just runs and exits.
    await expect(openWith(process.execPath, "--version")).resolves.toBeUndefined();
  });
});
