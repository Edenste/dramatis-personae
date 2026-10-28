# 0009. Development tooling: TypeScript, Vite, Vitest, Playwright, ESLint, Prettier and GitHub Actions

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The monorepo ([0007](0007-repository-structure.md)) needs a consistent set of tools for compiling, testing, linting and continuous integration across every package.

## Options considered

- **Unit tests:** Vitest (built on Vite, fast, native ESM) or Jest (older, slower with ESM and Vite projects).
- **End-to-end tests:** Playwright, which can drive both the packaged Electron app and an ordinary browser.
- **Linting and formatting:** ESLint + Prettier (mature Svelte support, and able to enforce import boundaries) or Biome (one fast tool, but with historically partial Svelte support).
- **CI:** GitHub Actions, where the repository and releases already live.

## Decision

| Area | Tool |
|---|---|
| Language | TypeScript in strict mode, everywhere |
| Web build and dev server | Vite (dev server with hot module replacement, forwarding `/api` and `/ws` to the Fastify server; production build into static files) |
| Unit and integration tests | Vitest; server tests use Fastify's `inject()` without a network |
| End-to-end tests | Playwright, against both the Electron app and a browser |
| Linting | ESLint with the Svelte plugin, including rules that enforce the package dependency boundaries from 0007 |
| Formatting | Prettier with the Svelte plugin |
| CI | GitHub Actions: type-check, lint, unit tests, end-to-end tests, a check that the generated API client is current ([0006](0006-server-framework.md)), and installer builds on release ([0008](0008-desktop-packaging.md)) |

## Consequences

- Vitest shares Vite's configuration and transforms, so `.svelte` and `.ts` files compile the same way in tests and in the app.
- One end-to-end tool covers both the desktop and browser versions.
- Package boundaries are checked automatically rather than by convention.
- ESLint and Prettier are two tools to configure instead of one; Biome can be reconsidered if its Svelte support matures.
