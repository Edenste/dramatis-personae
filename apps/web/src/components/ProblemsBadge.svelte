<script lang="ts">
  let { count, onopen }: { count: number; onopen: () => void } = $props();
  const label = $derived(count === 1 ? "1 problem" : `${count} problems`);
</script>

{#if count > 0}
  <button type="button" aria-label={label} title={label} onclick={onopen}>
    <span class="tabular">{count}</span>
  </button>
{/if}

<style>
  button {
    min-width: 18px;
    height: 18px;
    margin: 0 var(--space-1);
    padding: 0 5px;
    border: none;
    border-radius: 9px;
    background: var(--color-warning);
    color: var(--color-on-warning);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
  }
</style>
