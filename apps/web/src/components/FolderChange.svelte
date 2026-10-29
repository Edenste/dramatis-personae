<script lang="ts">
  import type { Status } from "@dramatis-personae/schema";
  import { unwrap, type Api } from "../lib/api.ts";
  import { toasts } from "../lib/toasts.svelte.ts";
  import Button from "./Button.svelte";

  let {
    api,
    desktop,
    label = "Change…",
    onchanged,
  }: {
    api: Api;
    desktop: Status["desktop"];
    label?: string;
    onchanged?: (path: string) => void;
  } = $props();

  let typing = $state(false);
  let typed = $state("");
  let saved = $state(false);
  const fieldId = `folder-${Math.random().toString(36).slice(2)}`;

  const report = (error: unknown) =>
    toasts.show(error instanceof Error ? error.message : "Something went wrong. Try again.");

  async function save(path: string): Promise<void> {
    try {
      unwrap(await api.PUT("/api/settings", { body: { dataPath: path } }));
      saved = true;
      typing = false;
      onchanged?.(path);
    } catch (error) {
      report(error);
    }
  }

  /** The desktop app opens the system folder picker; a browser types the path. */
  async function change(): Promise<void> {
    if (!desktop) {
      typing = true;
      return;
    }
    try {
      const { path } = unwrap(await api.POST("/api/data-folder/choose"));
      if (path) await save(path);
    } catch (error) {
      report(error);
    }
  }

  async function restart(): Promise<void> {
    try {
      unwrap(await api.POST("/api/restart"));
    } catch (error) {
      report(error);
    }
  }
</script>

<div class="folder-change">
  {#if typing}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        if (typed.trim()) void save(typed.trim());
      }}
    >
      <label for={fieldId} class="visually-hidden">New data folder</label>
      <input id={fieldId} bind:value={typed} placeholder="New data folder" />
      <Button variant="primary" type="submit" disabled={!typed.trim()}>Save</Button>
    </form>
  {:else}
    <Button onclick={() => void change()}>{label}</Button>
  {/if}

  {#if saved}
    {#if desktop}
      <p>Restart to use the new folder.</p>
      <Button variant="primary" onclick={() => void restart()}>Restart now</Button>
    {:else}
      <p>Restart the server to use the new folder.</p>
    {/if}
  {/if}
</div>

<style>
  .folder-change {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  form {
    display: flex;
    gap: var(--space-2);
    flex: 1;
  }

  input {
    flex: 1;
    min-width: 0;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-outline);
    border-radius: var(--radius-control);
    background: var(--color-page);
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
