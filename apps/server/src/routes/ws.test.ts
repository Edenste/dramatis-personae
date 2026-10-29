import { readFile, readdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket, { type ClientOptions } from "ws";
import { copyCamelot, type TempCamelot } from "@dramatis-personae/core/testing";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { ServerMessage } from "@dramatis-personae/schema";
import { TOKEN, testPaths, testServer, type TestServer } from "../test-utils/server.ts";

const WAIT = { timeout: 3000, interval: 50 };
const kayKey = `character:${CAMELOT_IDS.characters.Kay}`;
const gawainKey = `character:${CAMELOT_IDS.characters.Gawain}`;

interface Connection {
  socket: WebSocket;
  messages: ServerMessage[];
  closed: Promise<number>;
}

function connect(url: string, options: ClientOptions = {}): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, options);
    const messages: ServerMessage[] = [];
    const closed = new Promise<number>((done) => socket.on("close", (code) => done(code)));
    socket.on("message", (data: Buffer) =>
      messages.push(JSON.parse(data.toString()) as ServerMessage),
    );
    socket.on("open", () => resolve({ socket, messages, closed }));
    socket.on("unexpected-response", (_request, response) =>
      reject(Object.assign(new Error("refused"), { status: response.statusCode })),
    );
    socket.on("error", reject);
  });
}

describe("world WebSocket", () => {
  let camelot: TempCamelot;
  let server: TestServer;
  let origin: string;
  let wsUrl: string;
  const auth = { headers: { authorization: `Bearer ${TOKEN}` } };

  beforeEach(async () => {
    camelot = await copyCamelot();
    server = await testServer({
      temp: camelot,
      paths: testPaths(camelot),
      allowedHosts: undefined,
    });
    await server.app.listen({ host: "127.0.0.1", port: 0 });
    const { port } = server.app.server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws?world=${camelot.worldId}`;
  });
  afterEach(async () => {
    await server.close();
  });

  /** The server subscribes the socket once the world is open; opening it first makes that immediate. */
  const subscribed = async () => {
    const snapshot = await fetch(`${origin}/api/worlds/${camelot.worldId}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(snapshot.status).toBe(200);
  };

  const changedKeys = (messages: ServerMessage[]) =>
    messages.flatMap((m) =>
      m.type === "changed" ? m.files.map((f) => `character:${"id" in f.ref ? f.ref.id : ""}`) : [],
    );

  it("pushes the app's own changes", async () => {
    const { socket, messages } = await connect(wsUrl, auth);
    await subscribed();
    const response = await fetch(`${origin}/api/worlds/${camelot.worldId}/commands`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        commands: [
          { type: "character.update", id: CAMELOT_IDS.characters.Kay, set: { name: "Cai" } },
        ],
      }),
    });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(changedKeys(messages)).toContain(kayKey), WAIT);
    const after = await fetch(`${origin}/api/worlds/${camelot.worldId}`, auth);
    const { seq } = (await after.json()) as { seq: number };
    expect(seq).toBeGreaterThan(0);
    expect(messages.at(-1)?.seq).toBe(seq);
    socket.close();
  });

  it("pushes outside edits", async () => {
    const { socket, messages } = await connect(wsUrl, auth);
    await subscribed();
    const characters = join(camelot.worldPath, "characters");
    const file = join(
      characters,
      (await readdir(characters)).find((n) => n.startsWith("gawain-"))!,
    );
    const data = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...data, name: "Gawain the Green" }, null, 2) + "\n");
    await vi.waitFor(() => expect(changedKeys(messages)).toContain(gawainKey), WAIT);
    socket.close();
  });

  it.each([
    ["a foreign origin", { ...auth, origin: "https://evil.example" }],
    ["a wrong host", { headers: { ...auth.headers, host: "evil.example" } }],
    ["no token", {}],
  ])("refuses an upgrade with %s", async (_name, options: ClientOptions) => {
    await expect(connect(wsUrl, options)).rejects.toMatchObject({
      status: expect.any(Number) as number,
    });
  });

  it("closes with 4004 for a world that doesn't exist", async () => {
    const { closed, messages } = await connect(
      wsUrl.replace(camelot.worldId, "0000000000000000"),
      auth,
    );
    expect(await closed).toBe(4004);
    expect(messages).toEqual([]);
  });
});
