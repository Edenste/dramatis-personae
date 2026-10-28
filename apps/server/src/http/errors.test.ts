import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH, testServer, type TestServer } from "../test-utils/server.ts";

describe("error responses", () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await testServer();
    server.app.get("/api/boom", () => {
      throw new Error("secret internal detail");
    });
  });
  afterEach(async () => {
    await server.close();
  });

  it("answers an unknown API route with not-found", async () => {
    const response = await server.app.inject({ method: "GET", url: "/api/nope", headers: AUTH });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not-found", message: expect.any(String) });
  });

  it("hides unexpected errors behind a generic internal error", async () => {
    const response = await server.app.inject({ method: "GET", url: "/api/boom", headers: AUTH });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "internal", message: expect.any(String) });
    expect(response.body).not.toContain("secret internal detail");
  });

  it("names the failing field of an invalid body", async () => {
    const response = await server.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: AUTH,
      payload: { theme: "purple" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid", details: { path: "theme" } });
  });

  it("reports a body that isn't JSON as invalid", async () => {
    const response = await server.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { ...AUTH, "content-type": "application/json" },
      payload: "{ nope",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "invalid" });
  });
});
