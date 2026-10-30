<script lang="ts">
  import { characterById, type WorldState } from "../lib/world-mirror.ts";

  let { state, id }: { state: WorldState; id: string } = $props();
  const character = $derived(characterById(state, id));
</script>

<section>
  {#if character}
    <span class="ring" style:border-color={character.color} aria-hidden="true"></span>
    <h1>{character.name}</h1>
    <p>Profiles arrive in a later version.</p>
  {:else}
    <p>This character was deleted.</p>
  {/if}
</section>

<style>
  section {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-6);
  }

  h1 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .ring {
    width: 48px;
    height: 48px;
    border: 3px solid var(--color-character-default);
    border-radius: 50%;
    background: var(--color-fill);
  }
</style>
