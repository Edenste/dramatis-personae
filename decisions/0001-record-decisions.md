# 0001. Record decisions as ADRs

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The project is at the foundations stage and is making choices (runtime, rendering, framework, storage) that will shape everything built on top. The reasoning behind those choices is easy to lose, and is as useful to a reader of the repository as the code itself.

## Options considered

- **No formal record** — reasoning lives in commit messages and memory. Cheap, but scattered and quickly forgotten.
- **A single design document** — one place to read, but it gets edited over time and loses the history of why things changed.
- **Architecture Decision Records** — one short, numbered file per decision, kept immutable once accepted and superseded rather than edited.

## Decision

Use ADRs in a top-level `decisions/` folder, with an index in [README.md](README.md).

## Consequences

- Every significant decision gets a short written record before or alongside the work it affects.
- Changing a decision means writing a new record that supersedes the old one, so the history stays readable.
