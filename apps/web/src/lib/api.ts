import { createApiClient } from "@dramatis-personae/api-client";

export type Api = ReturnType<typeof createApiClient>;

/** The typed API on this page's own server; the token cookie goes with every request. */
export function createWebApi(
  options: { baseUrl?: string; fetch?: (input: Request) => Promise<Response> } = {},
): Api {
  return createApiClient({
    baseUrl: options.baseUrl ?? location.origin,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

/** An error reply from the API, in its { code, message, details? } shape. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

/** The reply's data, or an ApiFailure built from its error body. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok) return result.data as T;
  const error = result.error as
    { code?: unknown; message?: unknown; details?: unknown } | undefined;
  const isApiError = typeof error?.code === "string" && typeof error.message === "string";
  throw new ApiFailure(
    result.response.status,
    isApiError ? (error.code as string) : "internal",
    isApiError ? (error.message as string) : "Something went wrong. Try again.",
    isApiError ? error.details : undefined,
  );
}
