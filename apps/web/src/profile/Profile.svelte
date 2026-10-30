<script lang="ts">
  import NotesSection from "../notes/NotesSection.svelte";
  import { portraitSrc } from "../lib/portraits.ts";
  import { characterList, type WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "./actions.ts";
  import AddField from "./AddField.svelte";
  import FieldRow from "./FieldRow.svelte";
  import { profileView } from "./profile-view.ts";
  import ProfileHeader from "./ProfileHeader.svelte";
  import TemplatesRow from "./TemplatesRow.svelte";

  let {
    state,
    id,
    size,
    editing,
    actions,
  }: {
    state: WorldState;
    id: string;
    /** The full page, or the smaller card on the Graph. */
    size: "page" | "card";
    editing: boolean;
    actions: ProfileActions;
  } = $props();

  const view = $derived(profileView(state, id));
  /** The notes are edited on the full page only; a card shows them, and still lets a to-do be ticked. */
  const editableNotes = $derived(size === "page" && editing && actions.canEdit);
  const showNotes = $derived(view !== null && (view.character.body.trim() !== "" || editableNotes));
  const characters = $derived(characterList(state));
  const shown = $derived(view ? view.rows.filter((row) => editing || row.value !== undefined) : []);
</script>

{#if view}
  <article class="profile {size}">
    <ProfileHeader
      {view}
      {size}
      {editing}
      {actions}
      portrait={portraitSrc(state, actions.worldId, id)}
    />
    {#if shown.length > 0}
      <div class="fields">
        {#each shown as row (row.field.key)}
          <FieldRow {row} {view} {state} {characters} {editing} {actions} />
        {/each}
      </div>
    {/if}
    {#if editing}
      <div class="tools">
        <AddField {view} {actions} />
        {#if size === "page"}<TemplatesRow {view} {actions} />{/if}
      </div>
    {/if}
    {#if showNotes}
      <hr />
      <section class="notes">
        <NotesSection {view} {state} editable={editableNotes} {actions} />
      </section>
    {/if}
  </article>
{/if}

<style>
  .profile {
    display: grid;
    gap: var(--space-4);
  }

  .profile.card {
    gap: var(--space-3);
  }

  .fields {
    display: grid;
    gap: var(--space-2);
  }

  .tools {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
  }

  hr {
    width: 100%;
    margin: 0;
    border: none;
    border-top: 1px solid var(--color-hairline);
  }
</style>
