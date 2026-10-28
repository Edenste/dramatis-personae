import { describe, expect, it } from "vitest";
import { ALLOWED, findViolations } from "./check-boundaries.ts";

describe("findViolations", () => {
  it("reports an internal dependency that the table does not allow", () => {
    expect(
      findViolations(
        [{ name: "@dramatis-personae/core", deps: ["@dramatis-personae/server"] }],
        ALLOWED,
      ),
    ).toEqual(["@dramatis-personae/core may not depend on @dramatis-personae/server"]);
  });

  it("ignores external dependencies and allows listed internal ones", () => {
    expect(
      findViolations(
        [{ name: "@dramatis-personae/server", deps: ["@dramatis-personae/core", "fastify"] }],
        ALLOWED,
      ),
    ).toEqual([]);
  });

  it("allows the samples package as a dev dependency of any package", () => {
    expect(
      findViolations(
        [
          {
            name: "@dramatis-personae/core",
            deps: ["@dramatis-personae/schema"],
            devDeps: ["@dramatis-personae/samples"],
          },
        ],
        ALLOWED,
      ),
    ).toEqual([]);
  });

  it("rejects the samples package as a runtime dependency", () => {
    expect(
      findViolations(
        [{ name: "@dramatis-personae/core", deps: ["@dramatis-personae/samples"] }],
        ALLOWED,
      ),
    ).not.toEqual([]);
  });
});
