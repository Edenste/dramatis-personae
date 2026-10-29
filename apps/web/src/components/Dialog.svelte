<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import IconButton from "./IconButton.svelte";

  let {
    title,
    width = 360,
    onclose,
    children,
  }: { title: string; width?: number; onclose: () => void; children: Snippet } = $props();

  let panel: HTMLElement | undefined = $state();
  const titleId = `dialog-${Math.random().toString(36).slice(2)}`;

  const focusable = () => [
    ...(panel?.querySelectorAll<HTMLElement>(
      "input, select, textarea, button:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ) ?? []),
  ];

  $effect(() => {
    const items = focusable();
    (items.find((item) => item.matches("input, select, textarea")) ?? items[0])?.focus();
  });

  /** Esc closes; Tab stays inside the dialog. */
  function keydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
</script>

<div class="scrim" transition:fade={{ duration: 150 }}></div>
<div
  bind:this={panel}
  class="dialog"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
  style:width="{width}px"
  onkeydown={keydown}
  in:settleIn={{ origin: "center" }}
  out:settleOut={{ origin: "center" }}
>
  <header>
    <h2 id={titleId}>{title}</h2>
    <IconButton label="Close" onclick={onclose}><X size={16} strokeWidth={1.5} /></IconButton>
  </header>
  {@render children()}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: var(--color-scrim);
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 100;
    max-width: calc(100vw - var(--space-6));
    translate: -50% -50%;
    padding: var(--space-4);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }
</style>
