# 0002. Local Node server with a web client, in an Electron shell

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The first release is an installable desktop app that works offline and stores data on the user's machine. Later goals shape the architecture now, even though they are not built yet:

- **Sharing a world** — letting others view a relationship map read-only (like publishing a wiki for a series) or collaborate on it, by hosting it from the user's machine or on a server.
- **A cloud version** — the same app served from a URL, storing data in an online database, with the option for the desktop app to save to that database too.

## Options considered

- **Local Node server plus web client (FoundryVTT-style)** — a Node server owns the data folder and serves the UI; the desktop app launches the server and shows the UI in a window. The same server can run on its own for hosting or in the cloud.
- **Browser-only app** — a static site storing data in IndexedDB or a user-picked folder via the File System Access API. Simplest to host, but no real data folder, uneven browser support, and a backend still has to be built for sharing and cloud.
- **Desktop app with direct file access** — Electron (or Tauri) reads and writes files from the shell, with no HTTP server. Feels native, but sharing and cloud would require extracting the data layer into a server later.
- **Cloud-first thin client (Discord-style)** — the desktop app wraps a hosted web client and all data lives on a server. Rejected: it cannot work offline or keep data local.

## Decision

A **Node server** owns the user-data directory and exposes all data through an HTTP and WebSocket API. The WebSocket pushes changes to every open window, including edits made to the files outside the app. It also serves the **web client**. The first release ships inside an **Electron shell** that starts the server and opens the client in a window. The server can also run headless, without Electron.

## Consequences

- The client never touches the disk directly; the Electron window and a remote browser use exactly the same API.
- Every request is handled with a user and a role (owner, editor, viewer) from the start. In the first release this is always the single local owner, but permission checks exist from day one rather than being added later.
- The server listens only on `127.0.0.1` by default. Sharing is opt-in and per world: sharing one world never makes any other world reachable.
- The transport and server framework are covered in [0006](0006-server-framework.md).
- Storage sits behind an interface so a database-backed implementation can replace the file-based one for the cloud version.
- Documents carry a revision or timestamp so concurrent editing can be handled when collaboration arrives.
- A static, read-only export of a world remains an option for publishing without hosting a server.
- The cost is running a server even for a single local user. Electron bundles Node anyway, so there is no extra runtime to install.
