<script lang="ts">
  import { Check, Maximize2, Pencil, X } from "@lucide/svelte";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import type { WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import Profile from "../profile/Profile.svelte";
  import { profileView } from "../profile/profile-view.ts";
  import IconButton from "./IconButton.svelte";

  // `state` is aliased: a variable named `state` would make `$state` read as a store.
  let {
    state: world,
    id,
    name,
    actions,
    front,
    onclose,
    onexpand,
    ondragstart,
  }: {
    state: WorldState;
    id: string;
    name: string;
    actions: ProfileActions;
    front: boolean;
    onclose: () => void;
    onexpand: () => void;
    /** Pressing the top strip starts a drag. */
    ondragstart: (event: PointerEvent) => void;
  } = $props();

  let editing = $state(false);
  const blocked = $derived(profileView(world, id)?.blocked ?? false);

  // A file that breaks while it is being edited can't take edits any more.
  $effect(() => {
    if (blocked) editing = false;
  });
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
    {#if actions.canEdit}
      {#if editing}
        <button type="button" class="done" onclick={() => (editing = false)}>
          <Check size={14} strokeWidth={1.5} aria-hidden="true" />Done
        </button>
      {:else}
        <IconButton label="Edit {name}" disabled={blocked} onclick={() => (editing = true)}>
          <Pencil size={14} strokeWidth={1.5} />
        </IconButton>
      {/if}
    {/if}
    <IconButton label="Close {name}" onclick={onclose}>
      <X size={14} strokeWidth={1.5} />
    </IconButton>
  </div>
  <div class="body">
    <Profile state={world} {id} size="card" {editing} {actions} />
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
    flex: 1;
    min-height: 0;
    padding: var(--space-2) var(--space-3) var(--space-3);
    overflow: auto;
  }
</style>
