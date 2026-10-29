<script lang="ts">
  import type { Snippet } from "svelte";
  import { settleIn, settleOut } from "../lib/motion.ts";

  let {
    onclose,
    anchor,
    label,
    children,
  }: {
    onclose: () => void;
    /** Presses on the anchor (the button that opened it) don't count as outside. */
    anchor?: HTMLElement;
    label: string;
    children: Snippet;
  } = $props();

  let root: HTMLElement | undefined = $state();

  function outside(event: PointerEvent): void {
    const target = event.target as Node;
    if (root?.contains(target) || anchor?.contains(target)) return;
    onclose();
  }
</script>

<svelte:window
  onpointerdown={outside}
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === "Escape") onclose();
  }}
/>

<div
  bind:this={root}
  class="popover"
  role="menu"
  aria-label={label}
  in:settleIn={{ origin: "top left" }}
  out:settleOut={{ origin: "top left" }}
>
  {@render children()}
</div>

<style>
  .popover {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    z-index: 50;
    min-width: 220px;
    padding: var(--space-1);
    border-radius: var(--radius-menu);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
  }
</style>
