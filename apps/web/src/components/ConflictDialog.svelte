<script lang="ts">
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";

  let { onmine, ontheirs }: { onmine: () => void; ontheirs: () => void } = $props();
</script>

<!-- The notes can't save until one is chosen, so this can't be dismissed without choosing. -->
<Dialog title="These notes changed outside the app" dismissible={false} onclose={() => undefined}>
  <p>Keep your version, or take the version on disk?</p>
  <div class="buttons">
    <Button onclick={ontheirs}>Take theirs</Button>
    <Button variant="primary" onclick={onmine}>Keep mine</Button>
  </div>
</Dialog>

<style>
  p {
    margin: 0 0 var(--space-4);
    color: var(--color-text-secondary);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
