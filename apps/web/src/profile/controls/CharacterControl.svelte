<script lang="ts">
  import { ChevronsUpDown } from "@lucide/svelte";
  import Popover from "../../components/Popover.svelte";
  import Portrait from "../../components/Portrait.svelte";
  import type { CharacterSummary } from "../../lib/world-mirror.ts";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let {
    value,
    label,
    characters,
    onchange,
    onclear,
  }: ControlProps & { characters: CharacterSummary[] } = $props();

  const id = $props.id();
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let query = $state("");

  const chosen = $derived(characters.find((c) => c.id === value) ?? null);

  /** A name matches when any word of it starts with the query. */
  const matches = $derived.by(() => {
    const needle = query.trim().normalize("NFC").toLowerCase();
    if (needle === "") return characters;
    return characters.filter((c) =>
      c.name
        .normalize("NFC")
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(needle)),
    );
  });

  function choose(action: () => void): void {
    open = false;
    action();
  }

  function focus(node: HTMLElement): void {
    node.focus();
  }
</script>

<div class="ctl-wrap">
  <button
    bind:this={trigger}
    type="button"
    class="ctl ctl-pop"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-labelledby="{id}-label {id}-value"
    onclick={() => {
      open = !open;
      query = "";
    }}
  >
    <span id="{id}-label" class="ctl-sr">{label}</span>
    <span id="{id}-value" class="who" class:empty={!chosen}>
      {#if chosen}
        <Portrait color={chosen.color} size={14} />
        {chosen.name}
      {:else}
        Empty
      {/if}
    </span>
    <ChevronsUpDown size={14} strokeWidth={1.5} aria-hidden="true" />
  </button>

  {#if open}
    <Popover {label} role="dialog" anchor={trigger} onclose={() => (open = false)}>
      <div class="search">
        <input
          type="text"
          class="ctl"
          aria-label="Search characters"
          placeholder="Search characters"
          bind:value={query}
          use:focus
        />
      </div>
      <div role="listbox" aria-label="Characters" class="list">
        {#each matches as character (character.id)}
          <button
            type="button"
            role="option"
            aria-selected={character.id === value}
            class="ctl-item"
            onclick={() => choose(() => onchange(character.id))}
          >
            <span class="who"><Portrait color={character.color} size={14} />{character.name}</span>
          </button>
        {/each}
      </div>
      {#if matches.length === 0}
        <p class="none">No matching characters</p>
      {/if}
      <div class="ctl-separator" role="separator"></div>
      <button type="button" class="ctl-item" onclick={() => choose(onclear)}>Clear</button>
    </Popover>
  {/if}
</div>

<style>
  .who {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
  }

  .search {
    padding: var(--space-1);
  }

  .list {
    max-height: calc(var(--size-control) * 7);
    overflow: auto;
  }

  .none {
    margin: 0;
    padding: var(--space-2);
    color: var(--color-text-secondary);
  }
</style>
