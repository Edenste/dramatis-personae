# CLAUDE.md

Guidance for working in this repository.

## Project

**Dramatis Personae** is a character hub and relationship-mapping app for writers, worldbuilders and fans. Users build rich profiles for characters (World Anvil / anime-wiki style infoboxes with fillable fields) and explore how everyone connects through an interactive mind-map, in the spirit of Obsidian's graph view and the relationship charts common in anime fandoms.

## Status

Foundations is built: the data layer (`schema`, `core`), the local server, the generated API client, the Svelte web app (shell, tabs, worlds, Problems, Settings, character cards) and the Electron shell, with end-to-end tests and installer builds in CI. Profiles, the graph canvas, search, relationships and the calendar come in later specs. Decisions and their reasoning are recorded as ADRs in [decisions/](decisions/README.md). Decided so far:

- **Runtime:** a local Node server owns the data directory and serves a web client; the first release ships in an Electron shell, and the server can also run headless ([0002](decisions/0002-local-server-architecture.md)).
- **Graph:** a framework-independent canvas module using PixiJS v8, with d3-force running in a Web Worker ([0003](decisions/0003-graph-rendering.md)).
- **UI:** Svelte 5 + Vite + TypeScript, client-only (no SvelteKit) ([0004](decisions/0004-ui-framework.md)).
- **Storage:** one JSON file per document in a FoundryVTT-style data directory outside the install; external edits are watched and validated; search uses an in-memory index derived from the files; custom fields come from a per-world field library with a `default` flag ([0005](decisions/0005-storage.md)).

- **Server:** Fastify over one HTTP + WebSocket transport everywhere (the Electron window loads the local server); Zod route schemas; OpenAPI spec generated with `@fastify/swagger` and a typed client generated from it ([0006](decisions/0006-server-framework.md)).

- **Repository:** pnpm workspaces monorepo (`apps/desktop`, `apps/server`, `apps/web`, `packages/core`, `packages/schema`, `packages/graph`, `packages/api-client`, `samples/`) with enforced dependency boundaries; the app never writes to its install directory and user data lives in its own data root outside the repo ([0007](decisions/0007-repository-structure.md)).

- **Packaging:** Electron Forge — Squirrel.Windows one-click installer, DMG/ZIP on macOS, GitHub Releases publishing, auto-update via update.electronjs.org; the data root must never be inside the installer-managed folder ([0008](decisions/0008-desktop-packaging.md)).

- **Tooling:** TypeScript strict, Vite, Vitest, Playwright (Electron + browser), ESLint + Prettier (ESLint enforces package boundaries), GitHub Actions ([0009](decisions/0009-tooling.md)).

- **Data model:** random 16-character IDs with cosmetic names in file names (`lancelot-pm6i0t9upq3sgptb.json`); references use bare IDs; one file per pair of characters for relationships; libraries (fields, roles, relationship types, templates) in one ordered file each; documents (characters, relationships, events, views, searches) one file each ([0010](decisions/0010-world-data-model.md)).

- **Design language:** a Mac-native look — tabs in the title bar, rounded panels, floating character cards on the Graph, Apple's system colours, bundled Inter, and fade-and-settle motion; every colour, size and duration comes from design tokens ([0012](decisions/0012-design-language.md)).

- **Edits:** every edit is a command that returns its inverse; all writes go through one command endpoint; undo/redo lives in the client and clears on close; changes, including outside edits to the files, are pushed over WebSocket ([0011](decisions/0011-edits-as-commands.md)).

Do not assume undecided parts of the stack in code or docs. When a decision is made, add an ADR to `decisions/` and update this file, including the **Commands** and **Architecture** sections below.

## Commands

Requires Node ≥ 22 and pnpm 10. Run from the repository root:

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm test` | Run every Vitest project once (`pnpm vitest run <path>` for one file or folder) |
| `pnpm typecheck` | Type-check every package and `scripts/` |
| `pnpm lint` | ESLint across the repo |
| `pnpm format` / `pnpm format:check` | Format with Prettier, or check formatting without writing |
| `pnpm check:boundaries` | Fail if a package depends on an internal package that ADR 0007 doesn't allow |
| `pnpm --filter @dramatis-personae/server start -- [--data-path <dir>] [--port <n>] [--dev]` | Run the server headless; it prints a launch link carrying a one-time token |
| `pnpm --filter @dramatis-personae/desktop start` | Build and open the desktop app (dev data folder) |
| `pnpm --filter @dramatis-personae/desktop package` | Package the desktop app into `apps/desktop/out/` |
| `pnpm dev` | Run the server on the dev data folder and the web app with hot reload at http://127.0.0.1:5173 |
| `pnpm test:e2e` | Build the desktop app and run the Playwright tests in a browser and in Electron (first: `pnpm --filter @dramatis-personae/desktop exec playwright install chromium`; `E2E_SKIP_ELECTRON=1` skips Electron) |
| `pnpm --filter @dramatis-personae/web build` | Build the web app into `apps/web/dist` |
| `pnpm --filter @dramatis-personae/desktop make` | Build the installer (Squirrel on Windows, DMG and ZIP on macOS) into `apps/desktop/out/make/` |
| `pnpm generate:api` | Regenerate `packages/api-client` from the server's OpenAPI spec; commit the result |

CI (`.github/workflows/ci.yml`) checks the generated API client is current, then runs typecheck, lint, format check, boundary check and tests on Ubuntu and Windows, followed by the end-to-end tests (browser on both; the desktop app on Windows). `.github/workflows/installers.yml` builds the Windows and macOS installers for pull requests to `main`, pushes to `main` and on demand, and uploads them as artifacts without publishing.

## Architecture

Intended major pieces (subject to change):

- **Character profiles** — structured, template-driven pages with custom fields, an image/portrait, and free-form sections.
- **Relationship graph** — nodes are characters, edges are typed relationships. Two views:
  - **Neutral view**: every character and every relationship.
  - **Focus ("main character") view**: one character at the centre, others arranged by their relationship to them.
- **Relationship types** — user-defined; each has a label, colour, line style and direction (one-way or two-way).
- **Local-first storage** — user data lives on the user's machine, in a configurable location, and is never bundled into the repo or the app build.
- **Desktop shell** — wraps the web app as a native-feeling executable.

## Conventions

- Keep the app generic: it models "characters" and "relationships" with no assumptions about whether they come from fiction, games, tabletop campaigns or elsewhere.
- Sample, seed, test and demo data must use fictional or public-domain characters (e.g. the Arthurian cast). Never commit real user data.
- Data model changes need a migration path once a storage format exists.
- **Commits:**
  - Follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.
    - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`.
    - Scope is the package (`schema`, `core`, `server`, `web`, `desktop`, `graph`, `samples`), left out for repo-wide changes.
    - The subject is imperative and lowercase, has no full stop and is at most 72 characters. The optional body explains why.
    - Mark breaking changes with `!`.
  - One commit per feature, with its tests. Every commit must pass typecheck, lint and tests.
- **Branches:** development happens on `dev`. `main` only changes through pull requests from `dev`, merged by rebase. Pushing directly to `main` is blocked.
- UI colours, sizes, shadows and durations come only from `apps/web/src/styles/tokens.css`; components use its `var(--…)` names, never literal values. `tokens.test.ts` checks the colour contrast.
- Accessibility matters for the graph: keyboard navigation, readable labels, and colour choices that do not rely on hue alone (relationship types should also differ by line style or label).

## Repository layout

```
CLAUDE.md          development guidance (this file)
decisions/         architecture decision records (ADRs) and their index
apps/
  desktop/         Electron main process: starts the server, opens a locked-down window; bundled with esbuild; its `e2e/` folder holds the Playwright tests
  web/             Svelte 5 + Vite app: shell, tabs, worlds, Problems, Settings, cards; design tokens in `src/styles/tokens.css`
  server/          Fastify server: data root and Config/, security, routes, WebSocket, world sessions
packages/
  schema/          Zod schemas for files and API messages, IDs and file names
  core/            storage, world model, search, commands, migrations
  api-client/      typed HTTP client generated from the server's OpenAPI spec
  graph/           the graph's framework-free interface, with a placeholder list until the canvas is built
scripts/           repo tooling (package boundary check)
.github/workflows/ CI
.gitattributes     LF line endings everywhere
.gitignore
LICENSE            MIT
```

Add source directories here as they are created.
