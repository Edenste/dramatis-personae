import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./schema.d.ts";

export type { components, paths } from "./schema.d.ts";

export interface ApiClientOptions {
  /** The server's origin, such as http://127.0.0.1:30300. */
  baseUrl: string;
  fetch?: (input: Request) => Promise<Response>;
  headers?: Record<string, string>;
}

/** A client whose paths, parameters, bodies and responses are typed from the server's OpenAPI spec. */
export function createApiClient(options: ApiClientOptions): Client<paths> {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
  });
}
