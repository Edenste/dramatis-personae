import { createRequire } from "node:module";
import { win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultDataRoot } from "@dramatis-personae/server";

const require = createRequire(import.meta.url);
const forge = require("../forge.config.cjs") as {
  makers: Array<{ name: string; config?: { name?: string } }>;
};

const local = "C:\\Users\\a\\AppData\\Local";

describe("the installer and the data folder", () => {
  it("installs into a folder of its own: Squirrel's folder is named after the app", () => {
    const squirrel = forge.makers.find((maker) => maker.name === "@electron-forge/maker-squirrel");
    expect(squirrel?.config?.name).toBe("DramatisPersonae");
  });

  it.each([false, true])(
    "keeps the worlds outside that folder, so updating or uninstalling can't remove them (dev: %s)",
    (dev) => {
      const root = defaultDataRoot({
        platform: "win32",
        home: "C:\\Users\\a",
        vars: { LOCALAPPDATA: local },
        dev,
      });
      const installed = win32.join(local, "DramatisPersonae");
      expect(root).not.toBe(installed);
      expect(win32.relative(installed, root).startsWith("..")).toBe(true);
    },
  );
});
