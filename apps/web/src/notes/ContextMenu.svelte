<script lang="ts">
  import { ChevronRight } from "@lucide/svelte";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import { filterActions, type NoteAction } from "./actions.ts";
  import { ICONS } from "./icons.ts";

  let {
    x,
    y,
    groups,
    disabled,
    onchoose,
    onclose,
  }: {
    /** Where the menu was asked for, in window coordinates. */
    x: number;
    y: number;
    groups: NoteAction[][];
    disabled: ReadonlySet<string>;
    onchoose: (id: string) => void;
    onclose: () => void;
  } = $props();

  const WIDTH = 240;
  const HEIGHT = 340;
  const EDGE = 8;

  let query = $state("");
  /** The highlighted row; -1 until the arrow keys move it, except while searching. */
  let active = $state(-1);
  let submenu = $state<string | null>(null);
  let root: HTMLElement | undefined = $state();

  const searching = $derived(query.trim() !== "");
  const results = $derived(filterActions(groups, query));
  /** What the arrow keys walk through: the search results, or the top-level rows. */
  const rows = $derived(searching ? results : groups.flat());

  const left = $derived(Math.max(EDGE, Math.min(x, window.innerWidth - WIDTH - EDGE)));
  const top = $derived(Math.max(EDGE, Math.min(y, window.innerHeight - HEIGHT - EDGE)));

  function choose(action: NoteAction): void {
    if (disabled.has(action.id)) return;
    if (action.submenu) {
      submenu = submenu === action.id ? null : action.id;
      return;
    }
    onchoose(action.id);
  }

  function keydown(event: KeyboardEvent): void {
    const move = (step: number) => {
      event.preventDefault();
      active = (active + step + rows.length) % Math.max(rows.length, 1);
      submenu = null;
    };
    switch (event.key) {
      case "ArrowDown":
        return move(1);
      case "ArrowUp":
        return move(-1);
      case "ArrowRight": {
        const action = rows[active];
        if (action?.submenu) {
          event.preventDefault();
          submenu = action.id;
        }
        return;
      }
      case "ArrowLeft":
        submenu = null;
        return;
      case "Enter": {
        event.preventDefault();
        const action = rows[active];
        if (action) choose(action);
        return;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onclose();
        return;
    }
  }

  function outside(event: PointerEvent): void {
    if (!root?.contains(event.target as Node)) onclose();
  }

  function focus(node: HTMLElement): void {
    node.focus();
  }
</script>

<svelte:window onpointerdown={outside} />

<div
  bind:this={root}
  class="menu"
  role="menu"
  aria-label="Notes"
  tabindex="-1"
  style:left="{left}px"
  style:top="{top}px"
  onkeydown={keydown}
  in:settleIn={{ origin: "top left" }}
  out:settleOut={{ origin: "top left" }}
>
  <input
    type="text"
    class="search"
    aria-label="Search actions…"
    placeholder="Search actions…"
    bind:value={query}
    oninput={() => {
      active = query.trim() ? 0 : -1;
      submenu = null;
    }}
    use:focus
  />

  {#snippet row(action: NoteAction, index: number)}
    {@const Icon = ICONS[action.icon as keyof typeof ICONS]}
    <div class="slot">
      <button
        type="button"
        role="menuitem"
        class="item"
        class:active={index === active}
        class:danger={action.danger}
        aria-disabled={disabled.has(action.id) ? "true" : undefined}
        aria-haspopup={action.submenu ? "menu" : undefined}
        onmouseenter={() => {
          active = index;
          submenu = action.submenu ? action.id : null;
        }}
        onclick={() => choose(action)}
      >
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        <span class="label">{action.label}</span>
        {#if action.submenu}<ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />{/if}
      </button>
      {#if action.submenu && submenu === action.id}
        <div class="menu sub" role="menu" aria-label={action.label}>
          {#each action.submenu as item (item.id)}
            {@const SubIcon = ICONS[item.icon as keyof typeof ICONS]}
            <button type="button" role="menuitem" class="item" onclick={() => onchoose(item.id)}>
              <SubIcon size={16} strokeWidth={1.5} aria-hidden="true" />
              <span class="label">{item.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  {#if searching}
    {#each results as action, index (action.id)}
      {@render row(action, index)}
    {:else}
      <p class="none">No matching actions</p>
    {/each}
  {:else}
    {#each groups as group, g (g)}
      {#if g > 0}<div class="separator" role="separator"></div>{/if}
      {#each group as action (action.id)}
        {@render row(action, rows.indexOf(action))}
      {/each}
    {/each}
  {/if}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 120;
    width: 240px;
    padding: var(--space-1);
    border-radius: var(--radius-menu);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    outline: none;
  }

  .search {
    width: 100%;
    height: var(--size-control);
    margin-bottom: var(--space-1);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: var(--color-fill);
    outline: none;
  }

  .search:focus {
    box-shadow: inset 0 0 0 1px var(--color-accent-stroke);
  }

  .slot {
    position: relative;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: left;
    cursor: default;
  }

  .label {
    flex: 1;
  }

  .item.active,
  .item:hover:not([aria-disabled="true"]),
  .item:focus-visible {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .item[aria-disabled="true"] {
    color: var(--color-text-disabled);
  }

  .item.danger:not(.active):not(:hover) {
    color: var(--color-danger);
  }

  .separator {
    height: 1px;
    margin: var(--space-1) 0;
    background: var(--color-outline);
  }

  .sub {
    position: absolute;
    top: calc(var(--space-1) * -1);
    left: calc(100% + var(--space-1));
  }

  .none {
    margin: 0;
    padding: var(--space-2);
    color: var(--color-text-secondary);
  }
</style>
