import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH, testServer, type TestServer } from "../test-utils/server.ts";
import { securityHeaders } from "./headers.ts";

describe("securityHeaders", () => {
  it("lets the page connect only to its own server, over HTTP and WebSocket", () => {
    const csp = securityHeaders("127.0.0.1:30300")["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' ws://127.0.0.1:30300");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("security headers on responses", () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await testServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it("are sent with API responses and pages", async () => {
    for (const url of ["/api/status", "/"]) {
      const response = await server.app.inject({ method: "GET", url, headers: AUTH });
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["content-security-policy"]).toContain(
        "connect-src 'self' ws://127.0.0.1:30300",
      );
    }
  });
});
