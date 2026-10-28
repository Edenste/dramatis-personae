import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { pathOnly } from "./logger.ts";

/** An error with a status and code from the API's table; handlers throw it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply {
  return reply.code(status).send({ code, message, ...(details === undefined ? {} : { details }) });
}

/** Turns "/fields/0/key" into "fields.0.key". */
const dotted = (pointer: string) => pointer.replace(/^\//, "").replaceAll("/", ".");

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      return sendError(reply, error.status, error.code, error.message, error.details);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const first = error.validation[0];
      return sendError(reply, 400, "invalid", first?.message ?? "Invalid request", {
        path: dotted(first?.instancePath ?? ""),
        in: error.validationContext,
      });
    }
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      // Fastify's own client errors: unparseable JSON, unsupported content type and so on.
      return sendError(reply, error.statusCode, "invalid", error.message);
    }
    request.log.error({ err: error, url: pathOnly(request.url) }, "request failed");
    return sendError(reply, 500, "internal", "Something went wrong. The server log has details.");
  });
}

export function notFound(method: string, url: string): ApiError {
  return new ApiError(404, "not-found", `No route for ${method} ${pathOnly(url)}`);
}
