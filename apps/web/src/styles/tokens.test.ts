import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/contrast.ts";

// Vitest doesn't load CSS, so read the file itself.
const tokens = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

/** The `--color-*` values declared in the first block whose selector matches. */
function colours(selector: string): Record<string, string> {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in tokens.css`);
  const block = tokens.slice(start, tokens.indexOf("}", start));
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)) {
    result[match[1]!] = match[2]!.trim().toLowerCase();
  }
  return result;
}

const themes = { light: colours(":root"), dark: colours(':root[data-theme="dark"]') };

describe.each(Object.entries(themes))("the %s tokens", (_name, c) => {
  const pairs: Array<[string, string, string, string]> = [
    ["text", "page", c.text!, c.page!],
    ["text", "frame", c.text!, c.frame!],
    ["text", "surface", c.text!, c.surface!],
    ["text-secondary", "page", c["text-secondary"]!, c.page!],
    ["text-secondary", "frame", c["text-secondary"]!, c.frame!],
    ["text-secondary", "surface", c["text-secondary"]!, c.surface!],
    ["on-accent", "accent", c["on-accent"]!, c.accent!],
    ["danger", "page", c.danger!, c.page!],
    ["on-warning", "warning", c["on-warning"]!, c.warning!],
    ["page (toasts)", "text", c.page!, c.text!],
  ];

  it.each(pairs)("puts %s on %s at 4.5:1 or more", (_a, _b, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["page", c.page!],
    ["surface", c.surface!],
  ])("draws the focus ring on %s at 3:1 or more", (_b, bg) => {
    expect(contrastRatio(c["accent-stroke"]!, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("the accent colours", () => {
  it("use Apple's web blue for buttons and its bright blue for dark-mode rings", () => {
    expect(themes.light.accent).toBe("#0071e3");
    expect(themes.dark["accent-stroke"]).toBe("#0a84ff");
  });
});
