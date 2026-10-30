<script lang="ts">
  import { Check, Maximize2, Pencil, X } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import IconButton from "./IconButton.svelte";

  let {
    name,
    color,
    front,
    readOnly,
    onclose,
    onexpand,
    onrename,
    ondragstart,
  }: {
    name: string;
    color: string;
    front: boolean;
    readOnly: boolean;
    onclose: () => void;
    onexpand: () => void;
    onrename: (name: string) => void;
    /** Pressing the top strip starts a drag. */
    ondragstart: (event: PointerEvent) => void;
  } = $props();

  let editing = $state(false);
  let draft = $state(untrack(() => name));
  let sent = untrack(() => name);

  /** Saves a changed, non-empty name once. */
  function commit(): void {
    const next = draft.trim();
    if (next && next !== sent) {
      sent = next;
      onrename(next);
    }
  }

  function startEditing(): void {
    draft = name;
    sent = name;
    editing = true;
  }

  function finishEditing(): void {
    commit();
    editing = false;
  }
</script>

<div
  class="card"
  class:front
  role="dialog"
  aria-modal="false"
  aria-label={name}
  in:settleIn={{ origin: "top right" }}
  out:settleOut={{ origin: "top right" }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="strip" onpointerdown={ondragstart}>
    <IconButton label="Open {name} as a tab" onclick={onexpand}>
      <Maximize2 size={14} strokeWidth={1.5} />
    </IconButton>
    <span class="grow"></span>
    {#if !readOnly}
      {#if editing}
        <button type="button" class="done" onclick={finishEditing}>
          <Check size={14} strokeWidth={1.5} aria-hidden="true" />Done
        </button>
      {:else}
        <IconButton label="Edit {name}" onclick={startEditing}>
          <Pencil size={14} strokeWidth={1.5} />
        </IconButton>
      {/if}
    {/if}
    <IconButton label="Close {name}" onclick={onclose}>
      <X size={14} strokeWidth={1.5} />
    </IconButton>
  </div>
  <div class="body">
    <span class="ring" style:border-color={color} aria-hidden="true"></span>
    {#if editing}
      <input
        aria-label="Name"
        bind:value={draft}
        onkeydown={(event) => {
          if (event.key === "Enter") commit();
        }}
        onblur={commit}
      />
    {:else}
      <h2>{name}</h2>
    {/if}
  </div>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--color-surface);
    box-shadow: var(--shadow-raised);
  }

  .card.front {
    box-shadow: var(--shadow-floating);
  }

  .strip {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    height: 28px;
    padding: 0 var(--space-1);
    cursor: grab;
  }

  .grow {
    flex: 1;
  }

  .done {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--color-text-secondary);
  }

  .done:hover {
    background: var(--color-hover);
  }

  .body {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 0;
    padding: var(--space-2) var(--space-3) var(--space-3);
    overflow: auto;
  }

  .ring {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border: 2px solid var(--color-character-default);
    border-radius: 50%;
    background: var(--color-fill);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    letter-spacing: -0.01em;
  }

  input {
    flex: 1;
    min-width: 0;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-outline);
    border-radius: var(--radius-control);
    background: var(--color-page);
  }
</style>
