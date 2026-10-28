# 0004. Svelte 5, Vite and TypeScript for the UI

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The UI around the graph (profiles, slide-out panel, editors, toolbars, search, legend) is built in a web framework. The graph itself is drawn by its own canvas module ([0003](0003-graph-rendering.md)), so the framework does not render it, but it still matters for performance:

- The UI shares the main thread with the graph's render loop. At 60 fps there is roughly 16 ms per frame, and expensive UI updates during a drag cause dropped frames.
- Start-up time and memory use are noticeable in a desktop app.

The data and API are served by our own Node server ([0002](0002-local-server-architecture.md)), so the client is a single-page app, not a server-rendered site.

Reference figures from the [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/current.html) (Chrome 156, MacBook Pro M4), lower is better:

| Framework | Speed (weighted geometric mean) | Memory | Size (brotli) | First paint |
|---|---|---|---|---|
| Solid 1.9 | 1.14 | 1.28 | 4.5 kB | 54 ms |
| Svelte 5.42 | 1.19 | 1.48 | 9.7 kB | 66 ms |
| Vue 3.5 | 1.30 | 1.92 | 23.3 kB | 96 ms |
| React 19.2 | 1.56 | 2.62 | 51.4 kB | 228 ms |

## Options considered

- **Next.js** — a server-rendering React framework. Its server model (server components, route handlers, server actions) competes with our own server, it does not support WebSockets without a custom server, and server rendering offers nothing to a desktop app. Rejected.
- **React + Vite** — the largest ecosystem and the most job-market recognition, but heavier start-up and memory, and keeping it smooth beside the render loop needs careful memoisation.
- **Solid** — the fastest stable mainstream option with the smallest footprint, but a much smaller ecosystem.
- **Vue 3.6 Vapor** — fastest in the benchmark, but still a release candidate at the time of writing.
- **Niche frameworks** (re, Mikado, blockdom, Inferno, Ivi and others) — at or near vanilla JavaScript speed, but early versions or small communities. The gain over Svelte or Solid is negligible for this app.
- **Svelte 5 + Vite** — a compiler that turns components into direct DOM updates, using fine-grained signals (runes) instead of a virtual DOM.

## Decision

Use **Svelte 5** with **Vite** and **TypeScript**, as a client-only app talking to our own server. SvelteKit is not used.

Reasons:

- **Low runtime overhead.** Fine-grained updates touch only what changed, which keeps the UI from competing with the graph for frame time, and its small bundle and memory footprint help start-up in Electron.
- **Less code.** Single-file components with scoped CSS, and built-in transitions and motion, suit an animated, panel-heavy interface.
- **Learning.** The project is also an opportunity to learn a framework beyond React.

## Consequences

- The ecosystem is smaller than React's. Component libraries exist (for example shadcn-svelte and Bits UI), and the hard parts of this app are custom anyway.
- Much older material covers Svelte 4. Code here uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) throughout.
- The graph canvas module stays framework-independent, so this choice does not lock in the renderer.
