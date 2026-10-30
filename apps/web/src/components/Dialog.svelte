<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import IconButton from "./IconButton.svelte";

  let {
    title,
    subtitle,
    width = 360,
    placement = "center",
    dismissible = true,
    onclose,
    children,
  }: {
    title: string;
    /** A line of secondary text under the title. */
    subtitle?: string;
    width?: number;
    /** "top" comes down from the top of the window, like a macOS sheet. */
    placement?: "center" | "top";
    /** False for a question that must be answered: no close button, and Esc does nothing. */
    dismissible?: boolean;
    onclose: () => void;
    children: Snippet;
  } = $props();

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
      if (dismissible) onclose();
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
  class="dialog {placement}"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
  style:width="{width}px"
  onkeydown={keydown}
  in:settleIn={{ origin: placement === "top" ? "top center" : "center" }}
  out:settleOut={{ origin: placement === "top" ? "top center" : "center" }}
>
  <header>
    <div>
      <h2 id={titleId}>{title}</h2>
      {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
    </div>
    {#if dismissible}
      <IconButton label="Close" onclick={onclose}><X size={16} strokeWidth={1.5} /></IconButton>
    {/if}
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
    max-height: calc(100vh - var(--space-6));
    overflow: auto;
    translate: -50% -50%;
    padding: var(--space-4);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
  }

  .dialog.top {
    top: calc(var(--size-titlebar) + var(--space-2));
    translate: -50% 0;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-secondary);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }
</style>
