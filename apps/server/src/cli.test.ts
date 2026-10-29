import { describe, expect, it } from "vitest";
import { parseArgs } from "./cli.ts";

describe("parseArgs", () => {
  it("reads the data path, port, host and dev flag", () => {
    expect(parseArgs(["--data-path", "/w", "--port", "8080", "--dev"])).toEqual({
      dataPath: "/w",
      port: 8080,
      dev: true,
    });
    expect(parseArgs(["--data-path=/w", "--host=0.0.0.0"])).toEqual({
      dataPath: "/w",
      host: "0.0.0.0",
      dev: false,
    });
    expect(parseArgs([])).toEqual({ dev: false });
  });

  it("reads the folder of the built web app", () => {
    expect(parseArgs(["--web-root", "/w"])).toEqual({ webRoot: "/w", dev: false });
  });

  it("skips the -- separator that package managers pass through", () => {
    expect(parseArgs(["--", "--port", "0", "--dev"])).toEqual({ port: 0, dev: true });
  });

  it("refuses unknown flags and bad values, with the usage", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/Usage/);
    expect(() => parseArgs(["--port", "eighty"])).toThrow(/port/);
    expect(() => parseArgs(["--port", "70000"])).toThrow(/port/);
    expect(() => parseArgs(["--data-path"])).toThrow(/--data-path/);
  });
});
