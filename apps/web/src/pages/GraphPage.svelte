<script lang="ts">
  import { createGraphView, type GraphView } from "@dramatis-personae/graph";
  import type { CardState } from "@dramatis-personae/schema";
  import { onMount } from "svelte";
  import CardLayer from "../components/CardLayer.svelte";
  import { CARD, openCard, type Bounds } from "../lib/cards.ts";
  import { characterList, type WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";

  let {
    world,
    active,
    cards,
    actions,
    oncards,
    onopentab,
  }: {
    world: WorldState;
    /** False while another tab is showing, so the view can pause. */
    active: boolean;
    cards: CardState[];
    /** The app's profile actions; here a character link opens a card, not a tab. */
    actions: ProfileActions;
    oncards: (cards: CardState[]) => void;
    onopentab: (character: string) => void;
  } = $props();

  const cardActions: ProfileActions = {
    get worldId() {
      return actions.worldId;
    },
    get canEdit() {
      return actions.canEdit;
    },
    run: (batch) => actions.run(batch),
    runQuiet: (batch, options) => actions.runQuiet(batch, options),
    setPortrait: (id, bytes, crop) => actions.setPortrait(id, bytes, crop),
    removePortrait: (id) => actions.removePortrait(id),
    openTab: (tab) => actions.openTab(tab),
    openCharacter: (id) => oncards(openCard(cards, id, bounds, CARD.defaultHeight)),
  };

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
  <CardLayer {cards} state={world} actions={cardActions} {bounds} {oncards} {onopentab} />
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
