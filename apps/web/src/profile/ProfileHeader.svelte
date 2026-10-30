<script lang="ts">
  import { untrack } from "svelte";
  import Portrait from "../components/Portrait.svelte";
  import type { ProfileActions } from "./actions.ts";
  import PortraitMenu from "./PortraitMenu.svelte";
  import type { ProfileView } from "./profile-view.ts";

  let {
    view,
    size,
    editing,
    actions,
    portrait,
  }: {
    view: ProfileView;
    size: "page" | "card";
    editing: boolean;
    actions: ProfileActions;
    /** The thumbnail address, or null for the silhouette. */
    portrait: string | null;
  } = $props();

  const name = $derived(view.character.name);
  let draft = $state(untrack(() => name));
  let focused = $state(false);
  /** What was last sent, so Enter followed by a blur doesn't rename twice before the reply lands. */
  let sent: string | null = null;

  // A rename made elsewhere shows up, unless it would wipe what is being typed.
  $effect(() => {
    const next = name;
    if (!untrack(() => focused)) draft = next;
  });

  function commit(): void {
    const next = draft.trim();
    if (next === "" || next === name) {
      draft = name;
      return;
    }
    if (next === sent) return;
    sent = next;
    draft = next;
    void actions.run({
      commands: [{ type: "character.update", id: view.character.id, set: { name: next } }],
    });
  }
</script>

<header class="header {size}">
  <div class="avatar">
    <Portrait color={view.color} size={size === "page" ? 76 : 44} src={portrait} />
    {#if editing && actions.canEdit}<PortraitMenu {view} {actions} compact={size === "card"} />{/if}
  </div>
  <div class="who">
    {#if editing}
      <input
        class="name"
        aria-label="Name"
        bind:value={draft}
        onfocus={() => {
          focused = true;
          sent = null;
        }}
        onblur={() => {
          focused = false;
          commit();
        }}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          }
        }}
      />
    {:else if size === "page"}
      <h1 class="name">{name}</h1>
    {:else}
      <h2 class="name">{name}</h2>
    {/if}
    {#if view.subtitle}<p class="subtitle">{view.subtitle}</p>{/if}
    {#if view.roles.length > 0}
      <ul class="roles" aria-label="Roles">
        {#each view.roles as role (role.id)}
          <li class="chip">
            <span class="dot" style:--dot={role.color ?? "var(--color-character-default)"}></span>
            {role.name}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .header.card {
    gap: var(--space-3);
  }

  .avatar {
    position: relative;
    flex-shrink: 0;
  }

  .who {
    display: grid;
    flex: 1;
    gap: var(--space-1);
    min-width: 0;
  }

  .name {
    margin: 0;
    font-weight: var(--weight-semibold);
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  h1.name {
    font-size: var(--text-lg);
  }

  h2.name,
  .card input.name {
    font-size: var(--text-md);
    letter-spacing: -0.01em;
  }

  input.name {
    width: 100%;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: var(--color-page);
    box-shadow: inset 0 0 0 1px var(--color-outline);
  }

  .page input.name {
    height: calc(var(--size-control) + var(--space-1));
    font-size: var(--text-lg);
  }

  input.name:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--color-accent-stroke);
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    border-radius: var(--radius-chip);
    background: var(--color-fill);
    font-size: var(--text-xs);
    line-height: 20px;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--dot);
  }
</style>
