import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { User } from "@dramatis-personae/core";
import { sendError } from "./errors.ts";
import { securityHeaders } from "./headers.ts";
import { stripToken } from "./logger.ts";

/**
 * The token cookie's name, from the validated Host. Browsers share cookies
 * across ports, so each server (desktop app, headless, dev) gets its own.
 */
export function tokenCookieName(host: string): string {
  const port = /:(\d+)$/.exec(host)?.[1] ?? "80";
  return `dp_token_${port}`;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Who is asking; set once the token is checked. */
    user: User;
  }
}

export interface SecurityOptions {
  token: string;
  /** "host:port" values the server answers to. */
  allowedHosts: () => string[];
  user: User;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison; hashing first makes both sides the same length. */
function sameToken(candidate: string | undefined, token: string): boolean {
  return candidate !== undefined && timingSafeEqual(digest(candidate), digest(token));
}

function presentedToken(request: FastifyRequest, host: string): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return request.cookies[tokenCookieName(host)];
}

/** Paths a browser navigates to, where the launch link's ?token= is exchanged. */
const isPage = (path: string) => !path.startsWith("/api") && path !== "/ws";

/**
 * Every request: the Host must be one the server serves (DNS rebinding), any
 * Origin must be the app's own (cross-site requests), then the token must be
 * presented as the cookie or a Bearer header. Nothing is exempt.
 */
export function registerSecurity(app: FastifyInstance, options: SecurityOptions): void {
  app.decorateRequest("user", null as unknown as User);
  app.addHook("onSend", async (request, reply) => {
    const host = request.headers.host ?? "";
    if (options.allowedHosts().includes(host)) reply.headers(securityHeaders(host));
  });
  app.addHook("onRequest", async (request, reply) => {
    const hosts = options.allowedHosts();
    const host = request.headers.host ?? "";
    if (!hosts.includes(host)) {
      return sendError(reply, 403, "bad-host", "This server doesn't answer to that host name");
    }
    const origin = request.headers.origin;
    if (origin !== undefined && !hosts.some((host) => origin === `http://${host}`)) {
      return sendError(reply, 403, "bad-origin", "Requests from other sites aren't allowed");
    }

    const url = new URL(request.url, "http://local");
    const launchToken = url.searchParams.get("token");
    if (request.method === "GET" && isPage(url.pathname) && launchToken !== null) {
      if (!sameToken(launchToken, options.token)) {
        return sendError(reply, 401, "unauthorized", "That link has expired. Open the app again.");
      }
      reply.setCookie(tokenCookieName(host), options.token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
      return reply.redirect(stripToken(request.url), 302);
    }

    if (!sameToken(presentedToken(request, host), options.token)) {
      return sendError(reply, 401, "unauthorized", "Open the app from its window or launch link");
    }
    request.user = options.user;
  });
}
