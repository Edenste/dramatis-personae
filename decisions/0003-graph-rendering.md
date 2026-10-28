# 0003. Custom PixiJS renderer with d3-force in a Web Worker for the graph

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The relationship map is the core of the app and is a working canvas, not just a visualisation:

- A live force simulation: nodes repel each other, links act as springs, and the graph is pulled towards the centre.
- Nodes can be dragged and the rest of the graph reacts.
- Clicking a character opens their profile in a slide-out panel.
- Dropping one character onto another (with edit access) creates a relationship, and the layout re-settles around it.
- The visual style calls for portrait nodes, coloured and styled edges (solid, dashed, dotted, glowing), labels and a legend.

It has to stay smooth while the simulation runs and the user interacts, without blocking the rest of the UI.

Obsidian's graph view, the closest reference, renders with PixiJS and runs a d3-force simulation in a Web Worker, after its developers moved away from D3 rendering for performance reasons.

## Options considered

- **PixiJS v8 + d3-force in a Web Worker** — WebGL/WebGPU rendering with full control over the look, and exactly the forces needed. Interaction (hit-testing, dragging, drop-to-connect, zoom) must be built in-house.
- **Sigma.js v3 + graphology** — WebGL with interaction built in and very high node counts. Custom node and edge styles require writing WebGL programs, and its standard layout is ForceAtlas2 rather than d3-force.
- **Cytoscape.js** — fastest to build, with rich styling and a drag-to-connect extension. Its canvas renderer slows under a continuous simulation with image nodes, and its WebGL renderer is still experimental.
- **force-graph** — canvas plus d3-force, quick to set up, but the simulation runs on the main thread and styling control is limited.
- **cosmos.gl** — GPU-computed layout scaling to a million nodes, but nodes are points without portraits or labelled edges. Wrong fit.

## Decision

Build the graph as a **self-contained canvas module**: **PixiJS v8** for rendering and **d3-force** (many-body, link, centre, collide) running in a **Web Worker**.

## Consequences

- The module has a small event interface (for example: select, hover, connect, move) and does not depend on the UI framework. The surrounding UI talks to it only through that interface.
- The simulation runs off the main thread. Positions flow back as typed arrays; drag and new-link events flow to the worker, which pins nodes and reheats the simulation.
- The simulation and render loop stop when the layout settles, so an idle graph uses no CPU.
- Performance techniques planned from the start: viewport culling, level of detail (hiding portraits and labels when zoomed out), and a shared texture atlas for portraits.
- Interaction code is ours to build and test.
- A canvas is not accessible by itself. Keyboard navigation and readable labels need a parallel DOM or keyboard layer alongside the canvas.
