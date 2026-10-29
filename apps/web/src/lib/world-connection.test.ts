import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandBatch, CommandResult } from "@dramatis-personae/schema";
import { FakeSocket, fakeFetch, type Reply } from "../test-utils/fakes.ts";
import { IDS, WORLD, characterFile, snapshot } from "../test-utils/fixtures.ts";
import { createWebApi } from "./api.ts";
import { UndoHistory } from "./undo.ts";
import { WorldConnection } from "./world-connection.svelte.ts";
import { characterById } from "./world-mirror.ts";

const base = `/api/worlds/${WORLD}`;
const rename: CommandBatch = { commands: [{ type: "world.rename", name: "Logres" }] };
const renamed: CommandResult = {
  inverse: { commands: [{ type: "world.rename", name: "Camelot" }] },
  fingerprints: { world: "f".repeat(64) },
};
const conflict: Reply = {
  status: 409,
  body: { code: "conflict", message: "world changed since you last saw it" },
};

describe("WorldConnection", () => {
  let server: ReturnType<typeof fakeFetch>;
  let history: UndoHistory;
  let toast: ReturnType<typeof vi.fn<(message: string) => void>>;
  let connection: WorldConnection;

  function connect(): WorldConnection {
    connection = new WorldConnection(WORLD, {
      api: createWebApi({ baseUrl: "http://127.0.0.1:30300", fetch: server.fetch }),
      history,
      toast,
      socket: (url) => new FakeSocket(url),
    });
    return connection;
  }

  /** Opens the connection, letting its socket connect. */
  async function opened(): Promise<WorldConnection> {
    const opening = connect().open();
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]!.open();
    await opening;
    return connection;
  }

  beforeEach(() => {
    FakeSocket.all = [];
    history = new UndoHistory();
    toast = vi.fn<(message: string) => void>();
    server = fakeFetch({ [`GET ${base}`]: { body: snapshot() } });
  });
  afterEach(() => {
    connection?.close();
    vi.useRealTimers();
  });

  it("connects the socket before asking for the snapshot, and drops older pushes", async () => {
    const opening = connect().open();
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    const socket = FakeSocket.all[0]!;
    expect(socket.url).toContain(`/ws?world=${WORLD}`);
    expect(server.requests).toHaveLength(0);
    socket.open();
    socket.push({
      type: "changed",
      world: WORLD,
      seq: 5,
      files: [characterFile(IDS.merlin, "Stale Merlin")],
      removed: [],
    });
    socket.push({
      type: "changed",
      world: WORLD,
      seq: 6,
      files: [characterFile(IDS.arthur, "Arthur Pendragon")],
      removed: [],
    });
    await opening;
    expect(connection.status).toBe("ready");
    expect(characterById(connection.state!, IDS.merlin)?.name).toBe("Merlin");
    expect(characterById(connection.state!, IDS.arthur)?.name).toBe("Arthur Pendragon");
  });

  it("records a successful command for undo", async () => {
    server.routes[`POST ${base}/commands`] = { body: renamed };
    await opened();
    expect(await connection.run(rename)).toEqual(renamed);
    expect(history.canUndo).toBe(true);
  });

  it("reports a refused command and records nothing", async () => {
    server.routes[`POST ${base}/commands`] = conflict;
    await opened();
    expect(await connection.run(rename)).toBeNull();
    expect(toast).toHaveBeenCalledWith("world changed since you last saw it");
    expect(history.canUndo).toBe(false);
  });

  it("undoes with expect, and drops an undo the server refuses", async () => {
    server.routes[`POST ${base}/commands`] = { body: renamed };
    await opened();
    await connection.run(rename);
    server.routes[`POST ${base}/commands`] = conflict;
    await connection.undo();
    expect(server.requests.at(-1)?.body).toEqual({
      commands: renamed.inverse.commands,
      expect: renamed.fingerprints,
    });
    expect(toast).toHaveBeenCalledWith("Can't undo: it was changed outside the app since.");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("undoes and redoes", async () => {
    server.routes[`POST ${base}/commands`] = { body: renamed };
    await opened();
    await connection.run(rename);
    await connection.undo();
    expect(history.canRedo).toBe(true);
    await connection.redo();
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("makes an unsaved change undoable only once a retry saves it", async () => {
    server.routes[`POST ${base}/commands`] = {
      status: 503,
      body: { code: "save-failed", message: "Couldn't save your change." },
    };
    server.routes[`POST ${base}/retry`] = { body: renamed };
    await opened();
    expect(await connection.run(rename)).toBeNull();
    expect(history.canUndo).toBe(false);
    await connection.retry();
    expect(history.canUndo).toBe(true);
  });

  it("refuses edits while a change is unsaved", async () => {
    server.routes[`GET ${base}`] = {
      body: snapshot({ unsaved: { message: "Couldn't save your change." } }),
    };
    await opened();
    expect(await connection.run(rename)).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't save your change.");
    expect(server.requests.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  it("records a fix only when it can be undone", async () => {
    server.routes[`POST ${base}/fixes`] = {
      body: { inverse: { commands: [] }, fingerprints: {} },
    };
    await opened();
    await connection.fix({ fix: "assignNewId", path: "characters/kay-copy.json" });
    expect(history.canUndo).toBe(false);
    server.routes[`POST ${base}/fixes`] = { body: renamed };
    await connection.fix({ fix: "removeReference", ref: { kind: "character", id: IDS.merlin } });
    expect(history.canUndo).toBe(true);
  });

  it("marks the world unavailable when the socket says so", async () => {
    await opened();
    FakeSocket.all[0]!.drop(4004, "Made by a newer version");
    expect(connection.status).toBe("unavailable");
    expect(connection.unavailableReason).toBe("Made by a newer version");
  });

  it("marks the world unavailable when it can't be opened", async () => {
    server.routes[`GET ${base}`] = {
      status: 409,
      body: { code: "migration-failed", message: "Couldn't update this world" },
    };
    await opened();
    expect(connection.status).toBe("unavailable");
    expect(connection.unavailableReason).toBe("Couldn't update this world");
  });

  it("reconnects after a drop, backing off, and fetches a fresh snapshot", async () => {
    await opened();
    vi.useFakeTimers();
    const snapshots = () => server.requests.filter((r) => r.path === base).length;
    FakeSocket.all[0]!.drop(1006);
    vi.advanceTimersByTime(499);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1]!.open();
    await vi.waitFor(() => expect(snapshots()).toBe(2));
    FakeSocket.all[1]!.drop(1006);
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(3);
  });
});
