# 0007. A pnpm monorepo, with the application kept separate from user data

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The app has several distinct pieces: the Electron shell, the Fastify server, the Svelte UI, the core logic, the graph canvas and a generated API client. Some must stay independent of others: the core must not depend on Fastify, and the graph module must not depend on Svelte ([0003](0003-graph-rendering.md), [0006](0006-server-framework.md)).

Separately, an installed desktop app has two halves, as FoundryVTT does:

- **The application**, in the install directory (for example under Program Files). Written only by the installer and updater, and replaced on every update.
- **The user's data**, in a user-data directory: configuration, worlds, backups and logs. Created on first launch, owned by the user, and freely editable ([0005](0005-storage.md)). Never touched by updates.

## Options considered

- **pnpm workspaces monorepo** — one repository, several packages, each declaring its dependencies. pnpm is fast and strict about undeclared dependencies.
- **npm workspaces monorepo** — the same layout with no extra tool, but looser about undeclared dependencies and slower.
- **A single package with folders** — simplest, but boundaries between pieces are only a convention and erode over time.

## Decision

Use a **pnpm workspaces monorepo**:

```
apps/
  desktop/      Electron main process: starts the server, opens the window, tray, updates
  server/       Fastify: routes, auth, WebSocket, static files, OpenAPI spec, data-root resolution
  web/          Svelte 5 + Vite UI
packages/
  core/         domain logic, search index, validation, permissions, storage interface + JSON file storage
  schema/       Zod schemas and shared types
  graph/        PixiJS + d3-force worker canvas module
  api-client/   types and typed client generated from the OpenAPI spec
samples/
  worlds/camelot/   a sample world in the real on-disk format, using public-domain characters
decisions/      architecture decision records
```

Allowed dependencies:

| Package | May depend on |
|---|---|
| `schema` | nothing internal |
| `core` | `schema` |
| `graph` | nothing internal |
| `api-client` | nothing internal (generated) |
| `server` | `core`, `schema` |
| `web` | `graph`, `api-client`, `schema` |
| `desktop` | `server` |

**Application and user data stay separate:**

- The repository builds only the application half. User data never lives in the repository.
- The installed app never writes to its install directory.
- The data root is our own directory, containing `Config/`, `Data/`, `Backups/` and `Logs/`. Defaults:
  - Windows: `%LOCALAPPDATA%\DramatisPersonae Data`
  - macOS: `~/Library/Application Support/Dramatis Personae Data`
  - Linux: `$XDG_DATA_HOME/dramatis-personae` (usually `~/.local/share/dramatis-personae`)
- The data root is never inside a folder managed by the installer or updater ([0008](0008-desktop-packaging.md)), and Electron's own internal files (caches, browser storage) are kept out of it.
- The app shows the current data root in its settings and offers an "Open data folder" command.
- The data root is resolved by the server package, not the desktop app, so the headless server behaves the same. The order is: a `--data-path` flag or environment variable, then `dataPath` in `Config/options.json`, then the platform default.
- Development runs use a separate data root (for example `%LOCALAPPDATA%\DramatisPersonae-dev`) and tests use temporary directories.

## Consequences

- Package boundaries are enforced by declared dependencies, and each package can be built and tested on its own.
- The sample world is documentation of the file format, a test fixture and a first-run demo at once.
- Electron packaging tools may need pnpm's hoisted layout (`node-linker=hoisted`) for the desktop app.
- Build-caching tools (Turborepo, Nx) can be added later if builds become slow.
- The data layout leaves room for a future folder of user-installed add-ons, such as shareable field libraries or relationship-type packs.
