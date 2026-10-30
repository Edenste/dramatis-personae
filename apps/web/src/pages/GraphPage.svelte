<script lang="ts">
  import { createGraphView, type GraphView } from "@dramatis-personae/graph";
  import type { CardState } from "@dramatis-personae/schema";
  import { onMount } from "svelte";
  import CardLayer from "../components/CardLayer.svelte";
  import { CARD, openCard, type Bounds } from "../lib/cards.ts";
  import { characterList, type WorldState } from "../lib/world-mirror.ts";

  let {
    world,
    active,
    cards,
    oncards,
    onopentab,
    onrename,
  }: {
    world: WorldState;
    /** False while another tab is showing, so the view can pause. */
    active: boolean;
    cards: CardState[];
    oncards: (cards: CardState[]) => void;
    onopentab: (character: string) => void;
    onrename: (character: string, name: string) => void;
  } = $props();

  let host: HTMLElement | undefined = $state();
  let panel: HTMLElement | undefined = $state();
  let bounds = $state<Bounds>({ width: 0, height: 0 });
  let view: GraphView | undefined;

  const nodes = $derived(
    characterList(world).map((c) => ({ id: c.id, label: c.name, color: c.color })),
  );

  onMount(() => {
    view = createGraphView(host!, { nodes, edges: [] });
    const stop = view.on((event) => {
      if (event.type === "select") oncards(openCard(cards, event.id, bounds, CARD.defaultHeight));
    });
    // A hidden panel measures zero; ignore that so cards keep their stored places.
    const measure = ({ width, height }: { width: number; height: number }) => {
      if (width > 0 && height > 0) bounds = { width, height };
    };
    measure(panel!.getBoundingClientRect());
    const watcher = new ResizeObserver(([entry]) => measure(entry!.contentRect));
    watcher.observe(panel!);
    return () => {
      stop();
      watcher.disconnect();
      view?.destroy();
    };
  });

  $effect(() => {
    view?.update({ nodes, edges: [] });
  });

  $effect(() => {
    view?.setActive(active);
  });
</script>

<div class="graph" bind:this={panel}>
  <div class="canvas" bind:this={host}></div>
  <CardLayer
    {cards}
    state={world}
    readOnly={world.readOnly}
    {bounds}
    {oncards}
    {onopentab}
    {onrename}
  />
</div>

<style>
  .graph {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .canvas {
    position: absolute;
    inset: 0;
    overflow: auto;
    padding: var(--space-5) var(--space-6);
  }

  .canvas :global(ul) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .canvas :global(button) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-control);
    background: var(--color-surface);
  }

  .canvas :global(button:hover) {
    background: var(--color-hover);
  }

  .canvas :global(.dp-graph-ring) {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-character-default);
    border-radius: 50%;
    background: var(--color-fill);
  }

  .canvas :global(.dp-graph-empty) {
    margin: 0;
    color: var(--color-text-secondary);
  }
</style>
