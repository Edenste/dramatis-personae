import { describe, expect, it } from "vitest";
import { devOriginAllowed } from "./dev-proxy.ts";

const dev = "http://127.0.0.1:5173";

describe("devOriginAllowed", () => {
  it("allows requests with no origin, or from the dev page itself", () => {
    expect(devOriginAllowed(undefined, dev)).toBe(true);
    expect(devOriginAllowed(dev, dev)).toBe(true);
  });

  it.each(["https://evil.example", "http://localhost:5173", "null"])(
    "refuses requests from %s",
    (origin) => {
      expect(devOriginAllowed(origin, dev)).toBe(false);
    },
  );
});
