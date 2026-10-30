<script lang="ts">
  // Test-only: holds the world in state, as the app does, so a change reaches the notes the same way.
  import NotesSection from "../notes/NotesSection.svelte";
  import { profileView } from "../profile/profile-view.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import type { WorldState } from "../lib/world-mirror.ts";

  let {
    first,
    next,
    id,
    actions,
  }: { first: WorldState; next: WorldState; id: string; actions: ProfileActions } = $props();

  let current = $state.raw<WorldState | null>(null);
  const world = $derived(current ?? first);
  const view = $derived(profileView(world, id));
</script>

<button type="button" onclick={() => (current = next)}>Change world</button>
{#if view}
  <NotesSection {view} state={world} editable={false} {actions} />
{/if}
