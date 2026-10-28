import { describe, expect, it } from "vitest";
import { fingerprint, serialize } from "./serialize.ts";

describe("serialize", () => {
  it("writes two-space JSON with a trailing newline", () => {
    expect(serialize({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("fingerprint", () => {
  it("is the SHA-256 hex digest", () => {
    expect(fingerprint("x")).toBe(
      "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881",
    );
  });

  it("gives the same result for a string and its UTF-8 bytes", () => {
    expect(fingerprint(new TextEncoder().encode("Café"))).toBe(fingerprint("Café"));
  });
});
