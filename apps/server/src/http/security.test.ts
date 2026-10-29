import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH, HOST, TOKEN, testServer, type TestServer } from "../test-utils/server.ts";

describe("request security", () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await testServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const status = (headers: Record<string, string>) =>
    server.app.inject({ method: "GET", url: "/api/status", headers });

  it("refuses a Host it doesn't serve, even with a valid token", async () => {
    const response = await status({ ...AUTH, host: "evil.example:30300" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "bad-host" });
    expect((await status(AUTH)).statusCode).toBe(200);
  });

  it("refuses a foreign Origin, even with a valid cookie", async () => {
    const cookie = `dp_token_30300=${TOKEN}`;
    const foreign = await status({ host: HOST, cookie, origin: "https://evil.example" });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toMatchObject({ code: "bad-origin" });
    const own = await status({ host: HOST, cookie, origin: "http://localhost:30300" });
    expect(own.statusCode).toBe(200);
  });

  it("needs the token", async () => {
    const none = await status({ host: HOST });
    expect(none.statusCode).toBe(401);
    expect(none.json()).toMatchObject({ code: "unauthorized" });
    expect((await status({ host: HOST, authorization: "Bearer wrong" })).statusCode).toBe(401);
    expect((await status({ host: HOST, cookie: "dp_token_30300=wrong" })).statusCode).toBe(401);
  });

  it("swaps the launch token for a cookie and drops it from the address", async () => {
    const response = await server.app.inject({
      method: "GET",
      url: `/?token=${TOKEN}&tab=graph`,
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/?tab=graph");
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain(`dp_token_30300=${TOKEN}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");

    const page = await server.app.inject({
      method: "GET",
      url: "/?tab=graph",
      headers: { host: HOST, cookie: `dp_token_30300=${TOKEN}` },
    });
    expect(page.statusCode).toBe(200);
  });

  it("refuses a wrong launch token", async () => {
    const response = await server.app.inject({
      method: "GET",
      url: "/?token=wrong",
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it.each(["//evil.example/x", "/\\evil.example/x"])(
    "keeps the launch redirect on the app for %s",
    async (path) => {
      const response = await server.app.inject({
        method: "GET",
        url: `${path}?token=${TOKEN}`,
        headers: { host: HOST },
      });
      expect(response.statusCode).toBe(302);
      const location = String(response.headers.location);
      expect(location.startsWith("/")).toBe(true);
      expect(location.startsWith("//")).toBe(false);
      expect(location.startsWith("/\\")).toBe(false);
    },
  );

  it("names the cookie after the port, and no longer accepts the old name", async () => {
    expect((await status({ host: HOST, cookie: `dp_token=${TOKEN}` })).statusCode).toBe(401);
    expect((await status({ host: HOST, cookie: `dp_token_30300=${TOKEN}` })).statusCode).toBe(200);
  });

  it("serves a placeholder page when there is no web app", async () => {
    const response = await server.app.inject({ method: "GET", url: "/", headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Dramatis Personae");
  });
});
