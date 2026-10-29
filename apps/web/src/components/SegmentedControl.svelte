<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value,
    onchange,
  }: {
    label: string;
    options: Array<{ value: T; label: string }>;
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class:on={option.value === value}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    padding: 2px;
    border-radius: 7px;
    background: var(--color-fill);
  }

  button {
    height: calc(var(--size-control) - 4px);
    padding: 0 var(--space-3);
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--color-text-secondary);
  }

  .on {
    background: var(--color-page);
    color: var(--color-text);
    box-shadow: var(--shadow-raised);
  }
</style>
