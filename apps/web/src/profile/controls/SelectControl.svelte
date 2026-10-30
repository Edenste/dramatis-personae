<script lang="ts">
  import { Check, ChevronsUpDown } from "@lucide/svelte";
  import Popover from "../../components/Popover.svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { field, value, label, onchange, onclear }: ControlProps = $props();

  const id = $props.id();
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  const current = $derived(typeof value === "string" ? value : "");

  function choose(action: () => void): void {
    open = false;
    action();
  }
</script>

<div class="ctl-wrap">
  <button
    bind:this={trigger}
    type="button"
    class="ctl ctl-pop"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-labelledby="{id}-label {id}-value"
    onclick={() => (open = !open)}
  >
    <span id="{id}-label" class="ctl-sr">{label}</span>
    <span id="{id}-value" class:empty={current === ""}>{current || "Empty"}</span>
    <ChevronsUpDown size={14} strokeWidth={1.5} aria-hidden="true" />
  </button>

  {#if open}
    <Popover {label} anchor={trigger} onclose={() => (open = false)}>
      {#each field.options ?? [] as option (option)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={option === current}
          class="ctl-item"
          onclick={() => choose(() => onchange(option))}
        >
          {option}
          {#if option === current}<Check size={14} strokeWidth={1.5} aria-hidden="true" />{/if}
        </button>
      {/each}
      <div class="ctl-separator" role="separator"></div>
      <button type="button" role="menuitem" class="ctl-item" onclick={() => choose(onclear)}>
        Clear
      </button>
    </Popover>
  {/if}
</div>
