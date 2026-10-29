export interface GraphNode {
  id: string;
  label: string;
  /** The ring colour, such as a character's colour. */
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** What the view reports to the surrounding UI (ADR 0003). */
export type GraphEvent =
  | { type: "select"; id: string }
  | { type: "hover"; id: string | null }
  | { type: "connect"; source: string; target: string }
  | { type: "move"; id: string; x: number; y: number };

/** The surrounding UI talks to the graph only through this interface. */
export interface GraphView {
  update(data: GraphData): void;
  /** An inactive view does no work, for example while its tab is hidden. */
  setActive(active: boolean): void;
  on(listener: (event: GraphEvent) => void): () => void;
  destroy(): void;
}
