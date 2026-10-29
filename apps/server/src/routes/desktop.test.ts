import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopHooks } from "../context.ts";
import { AUTH, testServer, type TestServer } from "../test-utils/server.ts";

const viewer = { id: "v", role: "viewer" } as const;

function fakeHooks() {
  const restart = vi.fn<() => void>();
  const appearanceChanged = vi.fn<DesktopHooks["appearanceChanged"]>();
  const hooks: DesktopHooks = {
    windowControls: "left",
    chooseFolder: () => Promise.resolve("C:\\Worlds"),
    restart,
    appearanceChanged,
  };
  return { hooks, restart, appearanceChanged };
}

describe("desktop hooks", () => {
  let server: TestServer;
  afterEach(async () => {
    await server.close();
  });

  const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
    server.app.inject({ method, url, headers: AUTH, ...(payload ? { payload } : {}) });

  it("reports no desktop app and refuses its actions without hooks", async () => {
    server = await testServer();
    expect((await call("GET", "/api/status")).json()).toMatchObject({ desktop: null });
    for (const url of ["/api/data-folder/choose", "/api/restart"]) {
      const response = await call("POST", url);
      expect(response.statusCode).toBe(501);
      expect(response.json()).toMatchObject({ code: "not-supported" });
    }
  });

  it("reports the window controls and picks a folder", async () => {
    server = await testServer({ desktop: fakeHooks().hooks });
    expect((await call("GET", "/api/status")).json()).toMatchObject({
      desktop: { windowControls: "left" },
    });
    const chosen = await call("POST", "/api/data-folder/choose");
    expect(chosen.statusCode).toBe(200);
    expect(chosen.json()).toEqual({ path: "C:\\Worlds" });
  });

  it("restarts only after replying", async () => {
    const fake = fakeHooks();
    server = await testServer({ desktop: fake.hooks });
    const response = await call("POST", "/api/restart");
    expect(response.statusCode).toBe(202);
    expect(fake.restart).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fake.restart).toHaveBeenCalledOnce());
  });

  it("tells the desktop app when the theme changes", async () => {
    const fake = fakeHooks();
    server = await testServer({ desktop: fake.hooks });
    await call("PUT", "/api/settings", { theme: "dark" });
    expect(fake.appearanceChanged).toHaveBeenCalledWith("dark");
  });

  it("lets only the owner change settings, open or choose folders, or restart", async () => {
    server = await testServer({ desktop: fakeHooks().hooks, user: viewer });
    const attempts = [
      await call("PUT", "/api/settings", { theme: "dark" }),
      await call("POST", "/api/data-folder/open"),
      await call("POST", "/api/data-folder/choose"),
      await call("POST", "/api/restart"),
    ];
    for (const response of attempts) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "forbidden" });
    }
  });
});
