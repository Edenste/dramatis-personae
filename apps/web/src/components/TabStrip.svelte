<script lang="ts">
  import { X } from "@lucide/svelte";
  import { PINNED, type TabAddress } from "../lib/address.ts";

  let {
    tabs,
    active,
    label,
    onselect,
    onclose,
  }: {
    tabs: TabAddress[];
    active: TabAddress;
    label: (tab: TabAddress) => string;
    onselect: (tab: TabAddress) => void;
    onclose: (tab: TabAddress) => void;
  } = $props();
</script>

<div class="strip" role="tablist">
  {#each tabs as tab (tab)}
    <div class="tab" class:active={tab === active}>
      <button
        type="button"
        role="tab"
        aria-selected={tab === active}
        title={label(tab)}
        onclick={() => onselect(tab)}
      >
        {label(tab)}
      </button>
      {#if !PINNED.includes(tab)}
        <button
          type="button"
          class="close"
          aria-label="Close {label(tab)}"
          onclick={() => onclose(tab)}
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    min-width: 96px;
    max-width: 200px;
    height: var(--size-control);
    border-radius: var(--radius-control);
    color: var(--color-text-secondary);
    transition: background-color var(--motion-hover);
    -webkit-app-region: no-drag;
  }

  .tab:hover:not(.active) {
    background: var(--color-hover);
  }

  .tab.active {
    background: var(--color-page);
    color: var(--color-text);
    box-shadow: 0 0 0 1px var(--color-hairline);
  }

  .tab button {
    border: none;
    background: none;
    color: inherit;
  }

  [role="tab"] {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 var(--space-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .close {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin-right: var(--space-1);
    padding: 0;
    border-radius: var(--radius-chip);
  }

  .close:hover {
    background: var(--color-hover);
  }
</style>
