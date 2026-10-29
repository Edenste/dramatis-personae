import type { WebSocketLike } from "../lib/world-connection.svelte.ts";

export interface Reply {
  status?: number;
  body?: unknown;
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
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
    const path = new URL(request.url).pathname;
    const text = request.body ? await request.text() : "";
    const body: unknown = text ? JSON.parse(text) : undefined;
    requests.push({
      method: request.method,
      path,
      body,
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
