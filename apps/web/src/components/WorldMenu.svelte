<script lang="ts">
  import { Check, ChevronDown } from "@lucide/svelte";
  import type { WorldSummary } from "@dramatis-personae/schema";
  import Popover from "./Popover.svelte";

  let {
    worlds,
    currentId,
    currentName,
    readOnly,
    onswitch,
    onnew,
    onrename,
    onfields,
    onopen,
  }: {
    worlds: WorldSummary[];
    currentId: string;
    currentName: string;
    readOnly: boolean;
    onswitch: (id: string) => void;
    onnew: () => void;
    onrename: () => void;
    /** Opens the Fields and templates tab. */
    onfields: () => void;
    /** Called as the menu opens, so the list can be refreshed. */
    onopen?: () => void;
  } = $props();

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  function choose(action: () => void): void {
    open = false;
    action();
  }
</script>

<div class="world-menu">
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => {
      open = !open;
      if (open) onopen?.();
    }}
  >
    {currentName}
    <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
  </button>

  {#if open}
    <Popover label="Worlds" anchor={trigger} onclose={() => (open = false)}>
      {#each worlds as world (world.id)}
        {@const current = world.id === currentId}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={current}
          class="item"
          class:current
          disabled={world.problem !== undefined}
          onclick={() => {
            // Svelte delegates clicks, so a disabled button's handler can still run.
            if (world.problem === undefined) choose(() => onswitch(world.id));
          }}
        >
          <span class="name">
            {current ? currentName : world.name}
            {#if world.problem}<span class="problem">{world.problem}</span>{/if}
          </span>
          {#if current}<Check size={14} strokeWidth={1.5} aria-hidden="true" />{/if}
        </button>
      {/each}
      <button type="button" role="menuitem" class="item" onclick={() => choose(onfields)}>
        Fields and templates
      </button>
      <div class="separator" role="separator"></div>
      <button type="button" role="menuitem" class="item" onclick={() => choose(onnew)}>
        New world…
      </button>
      {#if !readOnly}
        <button type="button" role="menuitem" class="item" onclick={() => choose(onrename)}>
          Rename {currentName}…
        </button>
      {/if}
    </Popover>
  {/if}
</div>

<style>
  .world-menu {
    position: relative;
    -webkit-app-region: no-drag;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    font-weight: var(--weight-semibold);
    transition: background-color var(--motion-hover);
  }

  .trigger:hover {
    background: var(--color-hover);
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: left;
  }

  .item:hover:not(:disabled),
  .item.current {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .item:disabled {
    color: var(--color-text-disabled);
  }

  .name {
    display: grid;
  }

  .problem {
    font-size: var(--text-xs);
  }

  .separator {
    height: 1px;
    margin: var(--space-1) 2px;
    background: var(--color-hairline);
  }
</style>
