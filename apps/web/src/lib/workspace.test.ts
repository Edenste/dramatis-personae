import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFetch } from "../test-utils/fakes.ts";
import { WORLD } from "../test-utils/fixtures.ts";
import { createWebApi } from "./api.ts";
import { WorkspaceState } from "./workspace.svelte.ts";

const path = `/api/worlds/${WORLD}/workspace`;
const kay = "character/kayxxxxxxxxxxxxx";
const merlin = "character/merlinxxxxxxxxxx";
const lancelot = "character/lancelotxxxxxxxx";

describe("WorkspaceState", () => {
  let server: ReturnType<typeof fakeFetch>;
  let keepalive: ReturnType<typeof fakeFetch>;
  let workspace: WorkspaceState;

  beforeEach(async () => {
    server = fakeFetch({
      [`GET ${path}`]: {
        body: { tabs: ["graph", "dashboard"], activeTab: "graph", recentCharacters: [], cards: {} },
      },
      [`PUT ${path}`]: (body) => ({ body }),
    });
    keepalive = fakeFetch({ [`PUT ${path}`]: { status: 200, body: {} } });
    workspace = new WorkspaceState(WORLD, {
      api: createWebApi({ baseUrl: "http://127.0.0.1:30300", fetch: server.fetch }),
      keepaliveFetch: keepalive.fetch,
    });
    await workspace.load();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const puts = () => server.requests.filter((r) => r.method === "PUT");

  it("opens tabs at the end and remembers characters, newest first", () => {
    workspace.open(kay);
    workspace.open(merlin);
    expect(workspace.tabs).toEqual(["graph", "dashboard", kay, merlin]);
    expect(workspace.active).toBe(merlin);
    expect(workspace.recent).toEqual(["merlinxxxxxxxxxx", "kayxxxxxxxxxxxxx"]);
    workspace.open(kay);
    expect(workspace.tabs).toEqual(["graph", "dashboard", kay, merlin]);
    expect(workspace.recent[0]).toBe("kayxxxxxxxxxxxxx");
  });

  it("closes a tab to its left neighbour and never closes a pinned tab", () => {
    workspace.open(kay);
    workspace.open(merlin);
    workspace.open(lancelot);
    expect(workspace.close(lancelot)).toBe(merlin);
    expect(workspace.tabs).toEqual(["graph", "dashboard", kay, merlin]);
    expect(workspace.close("graph")).toBe(merlin);
    expect(workspace.tabs).toContain("graph");
  });

  it("saves once, 300ms after a burst of changes", async () => {
    workspace.open(kay);
    workspace.open(merlin);
    workspace.close(merlin);
    vi.advanceTimersByTime(299);
    expect(puts()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toEqual({
      tabs: ["graph", "dashboard", kay],
      activeTab: kay,
      recentCharacters: ["merlinxxxxxxxxxx", "kayxxxxxxxxxxxxx"],
      cards: {},
    });
  });

  it("flushes a pending save at once, with keepalive, when the page goes away", async () => {
    workspace.open(kay);
    workspace.flush();
    await vi.waitFor(() => expect(keepalive.requests).toHaveLength(1));
    expect(keepalive.requests[0]!.keepalive).toBe(true);
    expect(keepalive.requests[0]!.body).toMatchObject({ tabs: ["graph", "dashboard", kay] });
    vi.advanceTimersByTime(1000);
    expect(puts()).toHaveLength(0);
  });
});
