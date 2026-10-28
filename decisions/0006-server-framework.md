# 0006. One HTTP and WebSocket transport, built with Fastify

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The server ([0002](0002-local-server-architecture.md)) runs inside Electron's main process for the desktop app, and later on its own for hosted or shared worlds and the cloud version. Two questions had to be settled:

1. **Transport.** How the UI talks to the server in each setting.
2. **Framework.** What handles routing, validation, middleware, static files and WebSockets.

The aim is to avoid technical debt from the start.

## Options considered

**Transport**

- **Electron IPC on desktop, HTTP when hosted** — IPC avoids an open port and is marginally faster per call. But it means two transports: two sets of handlers, two clients, and bugs that appear in only one of them. The speed difference is irrelevant, because performance-critical work (graph physics and rendering) never crosses this boundary.
- **One framework behind a custom Electron protocol on desktop** — one router and no port, but WebSocket-style push is not available over a custom protocol, so live updates would need a second mechanism.
- **One HTTP and WebSocket transport everywhere** — the desktop window loads the local server just as a browser would. This is how FoundryVTT's desktop app works.

**Framework**

- **Node's built-in `http`** — no dependencies, but routing, body parsing, validation, errors, static files and WebSocket upgrades are all hand-written.
- **Express** — the most familiar, but dated, with weaker TypeScript support.
- **Koa** — minimal, little advantage over newer options.
- **NestJS** — heavily structured (modules, decorators, dependency injection); more framework than a small API needs.
- **Elysia** — fast with excellent types, but built for Bun, and Electron runs Node.
- **Hono** — small and built on web standards, with a typed client derived directly from server routes. Younger, with a smaller plugin set.
- **Fastify** — mature and widely used in production, an OpenJS Foundation project, with built-in schema validation, Pino logging, an encapsulated plugin system and a large official plugin set. End-to-end client types need an extra step.

## Decision

Use **one HTTP and WebSocket transport** in every setting, built with **Fastify**.

- In the desktop app, Electron's main process starts the server on `127.0.0.1` and the window loads it.
- Route schemas are written in **Zod** (via a Zod type provider), so the server validates input at runtime and handlers are typed.
- **`@fastify/swagger`** generates an **OpenAPI** spec from the route schemas. The client is generated from that spec (for example with `openapi-typescript` and `openapi-fetch`), so a change to an endpoint's path, parameters, body or response becomes a compile error in the UI.
- Live updates (such as files changed outside the app) are pushed over **`@fastify/websocket`**.
- The built UI is served with **`@fastify/static`**.
- Logs are written with Pino into the data directory's `Logs/` folder.

Fastify was chosen over Hono for its maturity and production track record, and for the OpenAPI spec, which doubles as API documentation for anyone using a shared or hosted world.

## Consequences

- One API, one client and one set of tests cover the desktop app, a local browser and a future hosted server.
- The UI can be developed in a normal browser with hot reload, and the API tested with `app.inject()` without starting Electron.
- Running a local port needs protection against other programs and malicious web pages: the server requires a per-launch secret token on every request and WebSocket connection, and checks the `Host` and `Origin` headers.
- The OpenAPI spec and generated client must stay current. Generation runs in the dev watcher, and CI fails if the committed client is out of date.
- Handlers stay thin and call the core, so the core remains independent of Fastify.
