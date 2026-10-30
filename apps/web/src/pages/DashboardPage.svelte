<script lang="ts">
  import { characterById, type WorldState } from "../lib/world-mirror.ts";

  let {
    state,
    recent,
    onopen,
  }: { state: WorldState; recent: string[]; onopen: (character: string) => void } = $props();

  const people = $derived(
    recent.map((id) => characterById(state, id)).filter((person) => person !== null),
  );
</script>

<section>
  <div class="coming">
    <h2>Coming up</h2>
    <p class="empty">Birthdays and events will count down here.</p>
  </div>
  <div class="recent">
    <h2>Recently opened</h2>
    {#if people.length === 0}
      <p class="empty">Characters you open will appear here.</p>
    {:else}
      <ul>
        {#each people as person (person.id)}
          <li>
            <button type="button" onclick={() => onopen(person.id)}>
              <span class="ring" style:border-color={person.color} aria-hidden="true"></span>
              {person.name}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  section {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: var(--space-6);
    padding: var(--space-5) var(--space-6);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }

  .empty {
    margin: 0;
    color: var(--color-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) 0;
    border: none;
    border-top: 1px solid var(--color-hairline);
    background: none;
    text-align: left;
  }

  button:hover {
    background: var(--color-hover);
  }

  .ring {
    width: 22px;
    height: 22px;
    border: 2px solid var(--color-character-default);
    border-radius: 50%;
    background: var(--color-fill);
  }
</style>
