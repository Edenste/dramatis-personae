# 0011. Edits as commands, with autosave, client-side undo and live updates

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

Edits to a world come from several places:

- the app;
- other open windows, and later other people;
- tools editing the files directly ([0005](0005-storage.md)).

The app saves automatically, with no Save button, and needs undo and redo that clear when the app is closed.

## Options considered

- **REST create/update/delete routes for each resource.** Familiar, but undo would need custom logic for every resource, and a change that spans several files has no single entry point.
- **Every edit as a named command.** Each command returns its own inverse, and all writes go through one endpoint.

**Where undo lives:**

- **On the server.** It would be shared by everyone viewing the world, which is wrong once several people edit it.
- **In each client.** It belongs to one session, so closing the page clears it.

## Decision

- **Commands:**
  - Every edit is a named command, such as `character.update` or `character.delete`.
  - `core` applies a command: it checks permissions, validates the command, changes the in-memory world and returns the file changes to write plus an **inverse** command.
  - Batches of commands are all-or-nothing.
- **Writes:**
  - All writes go through one endpoint, `POST /api/worlds/:w/commands`.
  - Reads are ordinary routes.
- **Undo and redo:**
  - Each client keeps an undo stack and a redo stack per world, built from the inverses.
  - They are cleared when the app or page closes.
  - A command can carry the file fingerprints it expects. An undo whose document has changed since, for example through an outside edit, is refused rather than overwriting newer work.
- **Live updates:**
  - After every change, the server pushes it over the world's WebSocket to every open window.
  - A file watcher picks up outside edits. It validates them, and either applies them or reports them as problems.
  - The watcher ignores the app's own writes by comparing file fingerprints.
- **Autosave and conflicts:**
  - Edits are saved as they are made, and the UI waits for the server's reply instead of updating optimistically.
  - Updates set individual keys, so edits to different fields never overwrite each other.
  - Concurrent edits to the same long-form text prompt the user to keep their version or take the other.

## Consequences

- **Undo for free:** every command has an inverse, and one test per command (applying it and then its inverse returns the original world) covers undo everywhere.
- **Edits spanning several files,** such as deleting a character together with its relationships, are a single command and a single undo step.
- **Multi-user editing:** future collaboration reuses the same commands, fingerprints and WebSocket messages.
- **One place for checks:** the single command endpoint is where permission checks, validation and logging all happen.
