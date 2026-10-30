import { describe, expect, it } from "vitest";
import { selfTestImages } from "./self-test.ts";

describe("selfTestImages", () => {
  it("makes a thumbnail and reports its size", async () => {
    expect(await selfTestImages()).toBe("images ok 256x256");
  });
});
