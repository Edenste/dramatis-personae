<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    variant = "secondary",
    children,
    ...rest
  }: {
    variant?: "primary" | "secondary" | "plain";
    children: Snippet;
  } & HTMLButtonAttributes = $props();
</script>

<button type="button" class={variant} {...rest}>{@render children()}</button>

<style>
  button {
    height: var(--size-control);
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-control);
    font-weight: var(--weight-medium);
    white-space: nowrap;
    cursor: default;
    transition: background-color var(--motion-hover);
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .secondary {
    background: var(--color-fill);
  }

  .secondary:hover:not(:disabled),
  .plain:hover:not(:disabled) {
    background: var(--color-hover);
  }

  .plain {
    background: none;
  }

  button:disabled {
    color: var(--color-text-disabled);
  }

  .primary:disabled {
    opacity: 0.5;
    color: var(--color-on-accent);
  }
</style>
