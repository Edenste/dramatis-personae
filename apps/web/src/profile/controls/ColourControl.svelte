<script lang="ts">
  import Popover from "../../components/Popover.svelte";
  import ColourSwatches from "../../components/ColourSwatches.svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { value, label, onchange, onclear }: ControlProps = $props();

  const id = $props.id();
  const current = $derived(typeof value === "string" ? value : null);
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let hex = $state("");
  let badHex = $state(false);

  function choose(color: string): void {
    open = false;
    onchange(color);
  }

  function submitHex(): void {
    const typed = hex.trim();
    badHex = !/^#[0-9a-fA-F]{6}$/.test(typed);
    if (!badHex) choose(typed);
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
      hex = current ?? "";
      badHex = false;
    }}
  >
    <span id="{id}-label" class="ctl-sr">{label}</span>
    <span class="swatch" style:--swatch={current ?? "transparent"} aria-hidden="true"></span>
    <span id="{id}-value" class="value" class:empty={current === null}>{current ?? "Empty"}</span>
  </button>

  {#if open}
    <Popover {label} role="dialog" anchor={trigger} onclose={() => (open = false)}>
      <ColourSwatches value={current} onpick={choose} />
      <div class="hex">
        <input
          type="text"
          class="ctl"
          class:invalid={badHex}
          aria-label="{label} hex"
          placeholder="#3b6fd4"
          bind:value={hex}
          onkeydown={(event) => event.key === "Enter" && submitHex()}
        />
      </div>
      <div class="ctl-separator" role="separator"></div>
      <button
        type="button"
        class="ctl-item"
        onclick={() => {
          open = false;
          onclear();
        }}
      >
        Clear
      </button>
    </Popover>
  {/if}
</div>

<style>
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px var(--color-outline);
  }

  .value {
    flex: 1;
    text-align: left;
  }

  .hex {
    padding: var(--space-1);
  }
</style>
