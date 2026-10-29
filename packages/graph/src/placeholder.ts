import type { GraphData, GraphEvent, GraphView } from "./types.ts";

/**
 * A plain list standing in for the canvas until the graph view is built:
 * every node as a button, ringed in its colour, reporting clicks as `select`.
 */
export function createGraphView(container: HTMLElement, data: GraphData): GraphView {
  const listeners = new Set<(event: GraphEvent) => void>();
  let destroyed = false;

  const emit = (event: GraphEvent) => {
    if (destroyed) return;
    for (const listener of listeners) listener(event);
  };

  function render({ nodes }: GraphData): void {
    if (nodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "dp-graph-empty";
      empty.textContent = "No characters yet.";
      container.replaceChildren(empty);
      return;
    }
    const list = document.createElement("ul");
    list.className = "dp-graph-placeholder";
    for (const node of [...nodes].sort((a, b) => a.label.localeCompare(b.label))) {
      const ring = document.createElement("span");
      ring.className = "dp-graph-ring";
      ring.style.borderColor = node.color;
      const button = document.createElement("button");
      button.type = "button";
      button.append(ring, document.createTextNode(node.label));
      button.addEventListener("click", () => emit({ type: "select", id: node.id }));
      const item = document.createElement("li");
      item.append(button);
      list.append(item);
    }
    container.replaceChildren(list);
  }

  render(data);
  return {
    update: (next) => {
      if (!destroyed) render(next);
    },
    setActive: () => undefined, // a static list has no work to pause
    on: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      destroyed = true;
      listeners.clear();
      container.replaceChildren();
    },
  };
}
