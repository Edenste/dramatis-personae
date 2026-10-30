import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

export const UNSUPPORTED_IMAGE =
  "That file isn't a supported image. Use JPG, PNG, WebP, GIF or AVIF.";

/** Fastify's own errors for a bad upload, as the answers the portrait routes give. */
export function portraitUploadError(error: FastifyError): FastifyError | ApiError {
  if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return new ApiError(413, "too-large", "Images must be under 20 MB.");
  }
  if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
    return new ApiError(415, "unsupported-image", UNSUPPORTED_IMAGE);
  }
  return error;
}

export function handleError(
  error: FastifyError | ApiError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
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
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler(handleError);
}

export function notFound(method: string, url: string): ApiError {
  return new ApiError(404, "not-found", `No route for ${method} ${pathOnly(url)}`);
}
