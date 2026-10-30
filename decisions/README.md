# Decision records

This folder records the significant technical and design decisions behind Dramatis Personae, and the reasoning for each, as [Architecture Decision Records](https://adr.github.io/) (ADRs).

Each record captures one decision: the context at the time, the options considered, what was chosen and why, and the consequences. Records are never rewritten after they are accepted. If a decision changes, a new record supersedes the old one and the old one's status is updated to point to it.

## Index

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-record-decisions.md) | Record decisions as ADRs | Accepted | 2026-10-28 |
| [0002](0002-local-server-architecture.md) | Local Node server with a web client, in an Electron shell | Accepted | 2026-10-28 |
| [0003](0003-graph-rendering.md) | Custom PixiJS renderer with d3-force in a Web Worker for the graph | Accepted | 2026-10-28 |
| [0004](0004-ui-framework.md) | Svelte 5, Vite and TypeScript for the UI | Accepted | 2026-10-28 |
| [0005](0005-storage.md) | JSON files as the source of truth, with a derived search index and a per-world field library | Accepted | 2026-10-28 |
| [0006](0006-server-framework.md) | One HTTP and WebSocket transport, built with Fastify | Accepted | 2026-10-28 |
| [0007](0007-repository-structure.md) | A pnpm monorepo, with the application kept separate from user data | Accepted | 2026-10-28 |
| [0008](0008-desktop-packaging.md) | Electron Forge for packaging, installers and auto-update | Accepted | 2026-10-28 |
| [0009](0009-tooling.md) | Development tooling: TypeScript, Vite, Vitest, Playwright, ESLint, Prettier and GitHub Actions | Accepted | 2026-10-28 |
| [0010](0010-world-data-model.md) | World data model: IDs, file names and document shapes | Accepted | 2026-10-28 |
| [0011](0011-edits-as-commands.md) | Edits as commands, with autosave, client-side undo and live updates | Accepted | 2026-10-28 |
| [0012](0012-design-language.md) | A Mac-native design language: tabs in the title bar, floating cards and fade-and-settle motion | Accepted | 2026-10-30 |
| [0013](0013-notes-editor.md) | CodeMirror 6 with a live preview for character notes | Accepted | 2026-10-30 |
| [0014](0014-image-processing.md) | `sharp` on the server for portraits | Accepted | 2026-10-30 |

## Adding a record

1. Copy the template below into `NNNN-short-title.md`, using the next free number.
2. Fill it in. Keep it short: a page is plenty.
3. Add a row to the index above.

Statuses: `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`.

```markdown
# NNNN. Title

- **Status:** Proposed
- **Date:** YYYY-MM-DD

## Context

What problem or question forced a decision, and what constraints apply.

## Options considered

- **Option A** — summary, pros, cons.
- **Option B** — summary, pros, cons.

## Decision

What was chosen, and the main reasons.

## Consequences

What becomes easier or harder as a result, and any follow-up work.
```
