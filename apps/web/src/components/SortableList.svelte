<script lang="ts" generics="T">
  import { GripVertical } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { dropGap, moveAnnouncement, targetIndex } from "../lib/sortable.ts";

  let {
    items,
    key,
    name,
    selected = null,
    disabled = false,
    onmove,
    onselect,
    row,
  }: {
    items: T[];
    /** Each item's identity, which keeps a row's focus while the order changes. */
    key: (item: T) => string;
    /** What assistive technology calls an item. */
    name: (item: T) => string;
    selected?: string | null;
    disabled?: boolean;
    /** An item was moved to this place in the list. */
    onmove: (key: string, index: number) => void;
    onselect?: (key: string) => void;
    row: Snippet<[T]>;
  } = $props();

  let list: HTMLElement | undefined = $state();
  let announcement = $state("");
  /** The row being dragged, the gap it is over, how far the pointer has moved and the row height. */
  let drag = $state<{ from: number; gap: number; dy: number; height: number } | null>(null);

  function nudge(event: KeyboardEvent, index: number): void {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (disabled || step === 0) return;
    event.preventDefault();
    const to = index + step;
    const item = items[index];
    if (item === undefined || to < 0 || to >= items.length) return;
    onmove(key(item), to);
    announcement = moveAnnouncement(name(item), to + 1, items.length);
  }

  function startDrag(event: PointerEvent, index: number): void {
    const item = items[index];
    if (disabled || event.button !== 0 || !list || item === undefined) return;
    // The press is left alone so the grip takes focus and the arrow keys then work on it.
    const rows = [...list.querySelectorAll<HTMLElement>("li[data-index]")];
    const tops = rows.map((r) => r.getBoundingClientRect().top);
    const height = rows[0]?.getBoundingClientRect().height ?? 0;
    const startY = event.clientY;
    drag = { from: index, gap: index, dy: 0, height };

    const move = (e: PointerEvent) => {
      drag = { from: index, gap: dropGap(e.clientY, tops, height), dy: e.clientY - startY, height };
    };
    const stop = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      const to = targetIndex(index, dropGap(e.clientY, tops, height));
      drag = null;
      if (to !== index) {
        onmove(key(item), to);
        announcement = moveAnnouncement(name(item), to + 1, items.length);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  /** How far a row slides to make room: the rows between the grabbed row and the gap move one row. */
  function shift(index: number): number {
    if (!drag || index === drag.from) return 0;
    const target = targetIndex(drag.from, drag.gap);
    if (drag.from < target && index > drag.from && index <= target) return -drag.height;
    if (drag.from > target && index >= target && index < drag.from) return drag.height;
    return 0;
  }
</script>

<ul class="list" bind:this={list}>
  {#each items as item, index (key(item))}
    <li
      data-index={index}
      class="item"
      class:lifted={drag?.from === index}
      style:transform="translateY({drag?.from === index ? drag.dy : shift(index)}px)"
    >
      <button
        type="button"
        class="grip"
        aria-label="Move {name(item)}"
        {disabled}
        onpointerdown={(event) => startDrag(event, index)}
        onkeydown={(event) => nudge(event, index)}
      >
        <GripVertical size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="row"
        class:selected={selected === key(item)}
        aria-pressed={selected === key(item)}
        onclick={() => onselect?.(key(item))}
      >
        {@render row(item)}
      </button>
    </li>
  {/each}
  {#if drag && targetIndex(drag.from, drag.gap) !== drag.from}
    <li class="drop" aria-hidden="true" style:top="{drag.gap * drag.height}px"></li>
  {/if}
</ul>
<div class="sr" role="status" aria-live="polite">{announcement}</div>

<style>
  .list {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
    user-select: none;
  }

  .item {
    display: flex;
    align-items: center;
    border-radius: var(--radius-control);
    background: var(--color-fill);
    transition: transform var(--motion-tab);
  }

  .item.lifted {
    position: relative;
    z-index: 2;
    box-shadow: var(--shadow-floating);
    transition: none;
  }

  /* Marks where the row will land. */
  .drop {
    position: absolute;
    right: 0;
    left: 0;
    z-index: 3;
    height: 2px;
    margin-top: -1px;
    border-radius: 1px;
    background: var(--color-accent-stroke);
    pointer-events: none;
  }

  .grip {
    display: grid;
    place-items: center;
    width: var(--size-control);
    height: var(--size-control);
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    cursor: grab;
    touch-action: none;
  }

  .grip:disabled {
    color: var(--color-text-disabled);
    cursor: default;
  }

  .row {
    flex: 1;
    min-width: 0;
    height: var(--size-control);
    padding: 0 var(--space-2) 0 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: left;
  }

  .row.selected {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
