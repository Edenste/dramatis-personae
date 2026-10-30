<script lang="ts">
  import type { CardState } from "@dramatis-personae/schema";
  import {
    bringToFront,
    clampCard,
    closeCard,
    moveCard,
    resizeCard,
    type Bounds,
    type Edge,
  } from "../lib/cards.ts";
  import { characterById, type WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import Card from "./Card.svelte";

  let {
    cards,
    state,
    actions,
    bounds,
    oncards,
    onopentab,
  }: {
    /** Front-most last. */
    cards: CardState[];
    state: WorldState;
    /** What the profiles in the cards can do; a link in a card opens another card. */
    actions: ProfileActions;
    /** The page panel's size; zero until it has been measured. */
    bounds: Bounds;
    oncards: (cards: CardState[]) => void;
    onopentab: (character: string) => void;
  } = $props();

  const measured = $derived(bounds.width > 0 && bounds.height > 0);
  const edges: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  /**
   * Cards are shown inside the page, but stored where they were placed: a smaller
   * window (the desktop app always opens at one size) must not move them for good.
   */
  const shown = $derived(measured ? cards.map((card) => clampCard(card, bounds)) : cards);

  // Drop cards for characters that are gone.
  $effect(() => {
    const kept = cards.filter((card) => characterById(state, card.character) !== null);
    if (kept.length !== cards.length) oncards(kept);
  });

  /** Follows the pointer until it's released, turning each position into a new card state. */
  function track(
    event: PointerEvent,
    character: string,
    change: (start: CardState, dx: number, dy: number) => CardState,
  ): void {
    const start = shown.find((c) => c.character === character);
    if (!start) return;
    event.preventDefault();
    const [x0, y0] = [event.clientX, event.clientY];
    const move = (e: PointerEvent) => {
      const next = change(start, e.clientX - x0, e.clientY - y0);
      oncards(cards.map((c) => (c.character === character ? next : c)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function press(character: string): void {
    if (cards.at(-1)?.character !== character) oncards(bringToFront(cards, character));
  }
</script>

<div class="layer">
  <!-- The front card is first in the document, so keyboard focus moves front to back. -->
  {#each [...shown].reverse() as card, index (card.character)}
    {@const summary = characterById(state, card.character)}
    {#if summary}
      {@const z = cards.length - index}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="slot"
        style:left="{card.x}px"
        style:top="{card.y}px"
        style:width="{card.width}px"
        style:height="{card.height}px"
        style:z-index={z}
        onpointerdown={() => press(card.character)}
      >
        <Card
          {state}
          id={card.character}
          name={summary.name}
          {actions}
          front={index === 0}
          onclose={() => oncards(closeCard(cards, card.character))}
          onexpand={() => {
            oncards(closeCard(cards, card.character));
            onopentab(card.character);
          }}
          ondragstart={(event: PointerEvent) => {
            if ((event.target as Element).closest("button")) return;
            track(event, card.character, (start, dx, dy) =>
              moveCard(start, start.x + dx, start.y + dy, bounds),
            );
          }}
        />
        {#each edges as edge (edge)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="handle {edge}"
            onpointerdown={(event: PointerEvent) =>
              track(event, card.character, (start, dx, dy) =>
                resizeCard(start, edge, dx, dy, bounds),
              )}
          ></div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .slot {
    position: absolute;
    pointer-events: auto;
  }

  .handle {
    position: absolute;
  }

  .n,
  .s {
    left: 6px;
    right: 6px;
    height: 6px;
    cursor: ns-resize;
  }

  .e,
  .w {
    top: 6px;
    bottom: 6px;
    width: 6px;
    cursor: ew-resize;
  }

  .n {
    top: -3px;
  }

  .s {
    bottom: -3px;
  }

  .e {
    right: -3px;
  }

  .w {
    left: -3px;
  }

  .ne,
  .nw,
  .se,
  .sw {
    width: 12px;
    height: 12px;
  }

  .ne {
    top: -3px;
    right: -3px;
    cursor: nesw-resize;
  }

  .nw {
    top: -3px;
    left: -3px;
    cursor: nwse-resize;
  }

  .se {
    right: -3px;
    bottom: -3px;
    cursor: nwse-resize;
  }

  .sw {
    bottom: -3px;
    left: -3px;
    cursor: nesw-resize;
  }
</style>
