<script lang="ts">
  import { Check, Plus, X } from "@lucide/svelte";
  import Popover from "../../components/Popover.svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { field, value, label, onchange, onclear }: ControlProps = $props();

  const listOf = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

  // Follows the value; a choice shows at once, ahead of the reply that confirms it.
  let selected = $derived(listOf(value));
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  /** Saves a new selection, in the order the field lists its options. */
  function toggle(option: string): void {
    const next = selected.includes(option)
      ? selected.filter((o) => o !== option)
      : [...selected, option];
    selected = (field.options ?? []).filter((o) => next.includes(o));
    if (selected.length > 0) onchange(selected);
    else onclear();
  }
</script>

<div class="ctl-wrap ctl-chips">
  {#each selected as option (option)}
    <span class="ctl-chip">
      {option}
      <button type="button" aria-label="Remove {option}" onclick={() => toggle(option)}>
        <X size={12} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </span>
  {/each}
  <button
    bind:this={trigger}
    type="button"
    class="ctl-add"
    aria-label={label}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
  </button>

  {#if open}
    <Popover {label} anchor={trigger} onclose={() => (open = false)}>
      {#each field.options ?? [] as option (option)}
        {@const ticked = selected.includes(option)}
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={ticked}
          class="ctl-item"
          onclick={() => toggle(option)}
        >
          {option}
          {#if ticked}<Check size={14} strokeWidth={1.5} aria-hidden="true" />{/if}
        </button>
      {/each}
    </Popover>
  {/if}
</div>
