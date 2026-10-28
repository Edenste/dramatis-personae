import { describe, expect, it } from "vitest";
import { createApiClient } from "./index.ts";

const world = "0v2zt9rkngnagdl3";

/** A fetch that records each request and answers with an empty JSON object. */
function recordingFetch() {
  const requests: Request[] = [];
  const fetch = (input: Request | string | URL, init?: RequestInit) => {
    requests.push(input instanceof Request ? input : new Request(input, init));
    return Promise.resolve(Response.json({}));
  };
  return { requests, fetch };
}

describe("createApiClient", () => {
  it("calls typed paths on the base URL with the given headers", async () => {
    const { requests, fetch } = recordingFetch();
    const client = createApiClient({
      baseUrl: "http://127.0.0.1:30300",
      fetch,
      headers: { authorization: "Bearer t" },
    });
    await client.GET("/api/worlds/{w}", { params: { path: { w: world } } });
    expect(requests[0]!.url).toBe(`http://127.0.0.1:30300/api/worlds/${world}`);
    expect(requests[0]!.method).toBe("GET");
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer t");
  });

  it("sends a command batch as JSON", async () => {
    const { requests, fetch } = recordingFetch();
    const client = createApiClient({ baseUrl: "http://127.0.0.1:30300", fetch });
    const batch = {
      commands: [{ type: "world.rename" as const, name: "Logres" }],
    };
    await client.POST("/api/worlds/{w}/commands", {
      params: { path: { w: world } },
      body: batch,
    });
    expect(requests[0]!.method).toBe("POST");
    expect(await requests[0]!.json()).toEqual(batch);
  });

  it("only knows the server's paths", () => {
    const client = createApiClient({ baseUrl: "http://127.0.0.1:30300" });
    // @ts-expect-error: no such path; this line fails typecheck if it ever becomes one.
    void client.GET("/api/nope").catch(() => undefined);
  });
});
