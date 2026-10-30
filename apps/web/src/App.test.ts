import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { createWebApi } from "./lib/api.ts";
import { navigate } from "./lib/router.svelte.ts";
import { FakeSocket, fakeFetch } from "./test-utils/fakes.ts";
import { WORLD, snapshot } from "./test-utils/fixtures.ts";

const LOGRES = "logresxxxxxxxxxx";
const summary = (id: string, name: string) => ({
  id,
  name,
  folder: `${name.toLowerCase()}-${id}`,
  schemaVersion: 1,
});
const emptyWorkspace = { tabs: [], activeTab: null, recentCharacters: [], cards: {} };

function server(worlds: unknown[], lastWorld: string | null) {
  return fakeFetch({
    "GET /api/status": {
      body: { version: "0.0.0", dataRoot: "/data", writable: true, desktop: null },
    },
    "GET /api/settings": {
      body: { dataRoot: "/data", defaultDataRoot: "/data", dataPath: null, theme: "light" },
    },
    "GET /api/worlds": { body: worlds },
    "GET /api/app-state": { body: { lastWorld } },
    "PUT /api/app-state": (body) => ({ body }),
    [`GET /api/worlds/${WORLD}`]: { body: snapshot() },
    [`GET /api/worlds/${LOGRES}`]: {
      body: snapshot({ world: summary(LOGRES, "Logres"), seq: 0 }),
    },
    [`GET /api/worlds/${WORLD}/workspace`]: { body: emptyWorkspace },
    [`GET /api/worlds/${LOGRES}/workspace`]: { body: emptyWorkspace },
    [`PUT /api/worlds/${WORLD}/workspace`]: (body) => ({ body }),
    [`PUT /api/worlds/${LOGRES}/workspace`]: (body) => ({ body }),
  });
}

function start(fake: ReturnType<typeof fakeFetch>) {
  render(App, {
    api: createWebApi({ baseUrl: location.origin, fetch: fake.fetch }),
    socket: (url: string) => new FakeSocket(url),
  });
}

const openSockets = () =>
  vi.waitFor(() => {
    expect(FakeSocket.all.length).toBeGreaterThan(0);
    for (const socket of FakeSocket.all) socket.open();
  });

describe("App", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    navigate("/", { replace: true });
  });

  it("invites you to create a world when there are none", async () => {
    start(server([], null));
    expect(await screen.findByText("Create your first world")).toBeTruthy();
  });

  it("opens the last world on its active tab", async () => {
    start(server([summary(WORLD, "Camelot"), summary(LOGRES, "Logres")], LOGRES));
    await openSockets();
    await vi.waitFor(() => expect(location.pathname).toBe(`/w/${LOGRES}/graph`));
  });

  it("opens the first world when the last one is gone", async () => {
    start(server([summary(WORLD, "Camelot")], "goneworldxxxxxxx"));
    await openSockets();
    await vi.waitFor(() => expect(location.pathname).toBe(`/w/${WORLD}/graph`));
  });

  it("switches to another world from the world menu, and stays there", async () => {
    start(server([summary(WORLD, "Camelot"), summary(LOGRES, "Logres")], WORLD));
    await openSockets();
    await vi.waitFor(() => expect(location.pathname).toBe(`/w/${WORLD}/graph`));
    await fireEvent.click(await screen.findByRole("button", { name: /Camelot/ }));
    await fireEvent.click(await screen.findByRole("menuitemradio", { name: /Logres/ }));
    await openSockets();
    await vi.waitFor(() => expect(location.pathname).toBe(`/w/${LOGRES}/graph`));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(location.pathname).toBe(`/w/${LOGRES}/graph`);
  });

  it("ends up on the world you went back to, and closes the one that lost the race", async () => {
    const fake = server([summary(WORLD, "Camelot"), summary(LOGRES, "Logres")], WORLD);
    let release: (() => void) | undefined;
    fake.routes[`GET /api/worlds/${LOGRES}`] = () =>
      new Promise((resolve) => {
        release = () => resolve({ body: snapshot({ world: summary(LOGRES, "Logres"), seq: 0 }) });
      });
    start(fake);
    await openSockets();
    await vi.waitFor(() => expect(location.pathname).toBe(`/w/${WORLD}/graph`));
    navigate(`/w/${LOGRES}/graph`);
    const logresSocket = await vi.waitFor(() => {
      const found = FakeSocket.all.find((socket) => socket.url.includes(LOGRES));
      expect(found).toBeDefined();
      return found!;
    });
    logresSocket.open();
    await vi.waitFor(() => expect(release).toBeDefined());
    navigate(`/w/${WORLD}/graph`);
    const camelotAgain = await vi.waitFor(() => {
      const found = FakeSocket.all.filter((socket) => socket.url.includes(WORLD)).at(-1);
      expect(FakeSocket.all.filter((socket) => socket.url.includes(WORLD)).length).toBe(2);
      return found!;
    });
    camelotAgain.open();
    release!();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(location.pathname).toBe(`/w/${WORLD}/graph`);
    expect(logresSocket.closed).toBe(true);
  });

  it("shows the chosen theme when Settings is opened again", async () => {
    const fake = server([summary(WORLD, "Camelot")], WORLD);
    fake.routes["PUT /api/settings"] = (body) => ({
      body: {
        settings: {
          dataRoot: "/data",
          defaultDataRoot: "/data",
          dataPath: null,
          ...(body as object),
        },
        restartRequired: false,
      },
    });
    start(fake);
    await openSockets();
    await fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await fireEvent.click(await screen.findByRole("radio", { name: "Dark" }));
    await fireEvent.keyDown(screen.getByRole("dialog", { name: "Settings" }), { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull());
    await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const dark = await screen.findByRole("radio", { name: "Dark" });
    expect(dark.getAttribute("aria-checked")).toBe("true");
  });

  it("renames the world from the world menu, and undoes it with the keys", async () => {
    const fake = server([summary(WORLD, "Camelot")], WORLD);
    const inverse = { commands: [{ type: "world.rename", name: "Camelot" }] };
    fake.routes[`POST /api/worlds/${WORLD}/commands`] = {
      body: { inverse, fingerprints: { world: "f".repeat(64) } },
    };
    start(fake);
    await openSockets();
    await fireEvent.click(await screen.findByRole("button", { name: /Camelot/ }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Rename Camelot…" }));
    const field = screen.getByLabelText("Name");
    await fireEvent.input(field, { target: { value: "Camelot Reborn" } });
    await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const posts = () => fake.requests.filter((r) => r.method === "POST");
    await vi.waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]!.body).toEqual({
      commands: [{ type: "world.rename", name: "Camelot Reborn" }],
    });
    const undo = screen.getByRole("button", { name: "Undo" });
    await vi.waitFor(() => expect(undo.hasAttribute("disabled")).toBe(false));
    await fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await vi.waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1]!.body).toEqual({ ...inverse, expect: { world: "f".repeat(64) } });
  });
});
