import type { CommandBatch, CommandResult } from "@dramatis-personae/schema";
import type { TabAddress } from "../lib/address.ts";
import type { WebSocketLike } from "../lib/world-connection.svelte.ts";
import type { ProfileActions } from "../profile/actions.ts";

export interface Reply {
  status?: number;
  body?: unknown;
}

export interface RecordedRequest {
  method: string;
  path: string;
  /** Parsed JSON, or the raw bytes of an octet-stream upload. */
  body: unknown;
  /** The query string, without the "?". */
  query: string;
  contentType: string;
  keepalive: boolean;
}

type Handler = (body: unknown) => Reply | Promise<Reply>;

/**
 * A fetch that answers from a table keyed by "METHOD /path" (no query string)
 * and records every request. Unknown routes give 404 in the API's error shape.
 */
export function fakeFetch(routes: Record<string, Handler | Reply> = {}) {
  const requests: RecordedRequest[] = [];
  const fetch = async (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const path = url.pathname;
    const contentType = request.headers.get("content-type") ?? "";
    let body: unknown;
    if (request.body && contentType.startsWith("application/octet-stream")) {
      body = new Uint8Array(await request.arrayBuffer());
    } else {
      const text = request.body ? await request.text() : "";
      body = text ? JSON.parse(text) : undefined;
    }
    requests.push({
      method: request.method,
      path,
      body,
      query: url.search.replace(/^\?/, ""),
      contentType,
      keepalive: init?.keepalive ?? request.keepalive,
    });
    const route = routes[`${request.method} ${path}`];
    const reply = typeof route === "function" ? await route(body) : route;
    if (!reply) {
      return Response.json({ code: "not-found", message: `No route for ${path}` }, { status: 404 });
    }
    const status = reply.status ?? 200;
    if (reply.body === undefined) return new Response(null, { status });
    return Response.json(reply.body, { status });
  };
  return { fetch, requests, routes };
}

/** Profile actions that record what they were asked to do instead of doing it. */
export function fakeActions(overrides: Partial<ProfileActions> = {}) {
  const batches: CommandBatch[] = [];
  /** The options each quiet save was sent with, in order. */
  const quietOptions: Array<{ keepalive?: boolean } | undefined> = [];
  const opened: string[] = [];
  const tabs: TabAddress[] = [];
  const result: CommandResult = { inverse: { commands: [] }, fingerprints: {} };
  const actions: ProfileActions = {
    worldId: "0v2zt9rkngnagdl3",
    canEdit: true,
    run: (batch) => {
      batches.push(batch);
      return Promise.resolve(result);
    },
    runQuiet: (batch, options) => {
      batches.push(batch);
      quietOptions.push(options);
      return Promise.resolve({ ok: true, result });
    },
    setPortrait: () => Promise.resolve(true),
    removePortrait: () => Promise.resolve(true),
    openCharacter: (id) => void opened.push(id),
    openTab: (tab) => void tabs.push(tab),
    ...overrides,
  };
  return { actions, batches, quietOptions, opened, tabs };
}

/** A WebSocket the test drives: open it, push messages, drop it. */
export class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  open(): void {
    this.onopen?.();
  }

  push(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code: number, reason = ""): void {
    this.onclose?.({ code, reason });
  }

  close(): void {
    this.closed = true;
  }
}
