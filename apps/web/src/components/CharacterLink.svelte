<script lang="ts">
  import type { CharacterSummary } from "../lib/world-mirror.ts";
  import Portrait from "./Portrait.svelte";

  let {
    character,
    label,
    onopen,
    thumbnail = null,
  }: {
    /** The character, or null when they no longer exist. */
    character: CharacterSummary | null;
    /** The name the link was written with; shown struck through if the character is gone. */
    label: string;
    onopen: (id: string) => void;
    thumbnail?: string | null;
  } = $props();
</script>

{#if character}
  <button
    type="button"
    role="link"
    class="link"
    aria-label="Open {character.name}"
    onclick={() => onopen(character.id)}
  >
    <Portrait color={character.color} size={14} src={thumbnail} />
    <span class="name">{character.name}</span>
  </button>
{:else}
  <s class="gone">{label}</s>
{/if}

<style>
  .link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: var(--weight-medium);
    color: var(--color-text);
    cursor: pointer;
  }

  .name {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-decoration-color: var(--color-hairline);
    text-underline-offset: 2px;
    transition: text-decoration-color var(--motion-hover);
  }

  .link:hover .name {
    text-decoration-color: var(--color-text);
  }

  .gone {
    color: var(--color-text-secondary);
  }
</style>
