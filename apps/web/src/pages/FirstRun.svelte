<script lang="ts">
  import Button from "../components/Button.svelte";

  let { oncreate }: { oncreate: (name: string) => void } = $props();
  let name = $state("");
</script>

<section>
  <h1>Create your first world</h1>
  <p>A world holds a cast of characters and how they're connected.</p>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      if (name.trim()) oncreate(name.trim());
    }}
  >
    <input bind:value={name} placeholder="World name" aria-label="World name" />
    <Button variant="primary" type="submit" disabled={!name.trim()}>Create world</Button>
  </form>
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
    margin: 0;
    color: var(--color-text-secondary);
  }

  form {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  input {
    width: min(200px, 100%);
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-outline);
    border-radius: var(--radius-control);
    background: var(--color-page);
  }
</style>
