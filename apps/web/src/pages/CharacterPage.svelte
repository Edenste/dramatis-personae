<script lang="ts">
  import Button from "../components/Button.svelte";
  import type { WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import Profile from "../profile/Profile.svelte";
  import { profileView } from "../profile/profile-view.ts";

  // Aliased: a variable named `state` would make `$state` read as a store.
  let {
    state: world,
    id,
    actions,
  }: { state: WorldState; id: string; actions: ProfileActions } = $props();

  let editing = $state(false);
  const view = $derived(profileView(world, id));
  const blocked = $derived(view?.blocked ?? false);

  // A file that breaks while it is being edited can't take edits any more.
  $effect(() => {
    if (blocked) editing = false;
  });
</script>

<section class="page">
  {#if view}
    <div class="bar">
      {#if actions.canEdit}
        {#if editing}
          <Button variant="primary" onclick={() => (editing = false)}>Done</Button>
        {:else}
          <Button disabled={blocked} onclick={() => (editing = true)}>Edit</Button>
        {/if}
      {/if}
    </div>
    {#if blocked}
      <p class="blocked">
        This character's file has a problem.
        <button type="button" class="link" onclick={() => actions.openTab("problems")}>
          See Problems
        </button>
      </p>
    {/if}
    <Profile state={world} {id} size="page" {editing} {actions} />
  {:else}
    <p class="gone">This character was deleted.</p>
  {/if}
</section>

<style>
  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-5) var(--space-6);
  }

  .bar {
    display: flex;
    justify-content: flex-end;
    min-height: var(--size-control);
    margin-bottom: var(--space-3);
  }

  .blocked {
    margin: 0 0 var(--space-3);
    color: var(--color-text-secondary);
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text);
    text-decoration: underline;
    text-decoration-color: var(--color-hairline);
    text-underline-offset: 2px;
  }

  .gone {
    margin: 0;
    color: var(--color-text-secondary);
  }
</style>
