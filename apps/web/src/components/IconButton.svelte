<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    disabled = false,
    onclick,
    children,
  }: { label: string; disabled?: boolean; onclick?: () => void; children: Snippet } = $props();
</script>

<button type="button" aria-label={label} title={label} {disabled} {onclick}>
  {@render children()}
</button>

<style>
  button {
    width: var(--size-control);
    height: var(--size-control);
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--color-text-secondary);
    transition: background-color var(--motion-hover);
  }

  button:hover:not(:disabled) {
    background: var(--color-hover);
    color: var(--color-text);
  }

  button:disabled {
    color: var(--color-text-disabled);
  }
</style>
