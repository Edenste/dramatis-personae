<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { SYSTEM_COLOURS } from "../lib/system-colours.ts";

  let {
    value,
    onpick,
  }: {
    /** The colour in use, ticked when it is one of the system colours. */
    value: string | null;
    onpick: (hex: string) => void;
  } = $props();

  const same = (hex: string) => value?.toLowerCase() === hex.toLowerCase();
</script>

<div class="swatches" role="group" aria-label="Colours">
  {#each SYSTEM_COLOURS as colour (colour.hex)}
    <button
      type="button"
      class="swatch"
      style:--swatch={colour.hex}
      aria-label={colour.name}
      aria-pressed={same(colour.hex)}
      onclick={() => onpick(colour.hex)}
    >
      {#if same(colour.hex)}<Check size={12} strokeWidth={2} aria-hidden="true" />{/if}
    </button>
  {/each}
</div>
<label class="other">
  Other…
  <input
    type="color"
    class="picker"
    aria-label="Other colour"
    value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#007aff"}
    onchange={(event) => onpick(event.currentTarget.value)}
  />
</label>

<style>
  .swatches {
    display: grid;
    grid-template-columns: repeat(7, var(--size-control));
    gap: var(--space-1);
    padding: var(--space-1);
  }

  .swatch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-control);
    height: var(--size-control);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--swatch);
    color: var(--color-on-accent);
    box-shadow: inset 0 0 0 1px var(--color-hover);
  }

  .other {
    display: flex;
    align-items: center;
    min-height: var(--size-control);
    padding: 0 var(--space-2);
    border-radius: var(--radius-control);
    cursor: pointer;
  }

  .other:hover,
  .other:focus-within {
    background: var(--color-hover);
  }

  .picker {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
</style>
