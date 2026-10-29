<script lang="ts">
  import Button from "./Button.svelte";

  let {
    unsaved,
    readOnly,
    onretry,
    ondiscard,
  }: {
    unsaved: { message: string } | null;
    readOnly: boolean;
    onretry: () => void;
    ondiscard: () => void;
  } = $props();
</script>

{#if unsaved}
  <div class="banner" role="alert">
    <span class="dot" aria-hidden="true"></span>
    <span class="message">{unsaved.message}</span>
    <Button variant="primary" onclick={onretry}>Retry</Button>
    <Button variant="plain" onclick={ondiscard}>Discard</Button>
  </div>
{:else if readOnly}
  <div class="banner" role="status">
    <span class="message">
      This world was made by a newer version of Dramatis Personae, so it's open read-only.
    </span>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-fill);
  }

  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-warning);
  }

  .message {
    flex: 1;
  }
</style>
