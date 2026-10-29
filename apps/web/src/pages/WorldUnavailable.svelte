<script lang="ts">
  import Button from "../components/Button.svelte";

  let { reason, onopenfolder }: { reason: string; onopenfolder: () => void } = $props();
</script>

<section>
  <h1>Can't open this world</h1>
  <p>{reason}</p>
  <Button onclick={onopenfolder}>Open data folder</Button>
</section>

<style>
  section {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  p {
    max-width: 480px;
    margin: 0 0 var(--space-2);
    color: var(--color-text-secondary);
  }
</style>
