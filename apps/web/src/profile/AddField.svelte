<script lang="ts">
  import { Plus } from "@lucide/svelte";
  import type { FieldDefinition } from "@dramatis-personae/schema";
  import Popover from "../components/Popover.svelte";
  import "./controls/controls.css";
  import type { ProfileActions } from "./actions.ts";
  import FieldForm from "./FieldForm.svelte";
  import type { ProfileView } from "./profile-view.ts";

  let { view, actions }: { view: ProfileView; actions: ProfileActions } = $props();

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let query = $state("");
  /** Set once "Create" is chosen: the form for a new field. */
  let creating = $state(false);

  const library = $derived([...view.rows.map((r) => r.field), ...view.unshownFields]);
  const needle = $derived(query.trim().toLowerCase());
  const matches = $derived(
    view.unshownFields.filter((f) => f.label.toLowerCase().includes(needle)),
  );
  const canCreate = $derived(
    needle !== "" && !library.some((f) => f.label.toLowerCase() === needle),
  );

  function close(): void {
    open = false;
    creating = false;
  }

  function add(field: FieldDefinition): void {
    close();
    void actions.run({
      commands: [
        {
          type: "character.update",
          id: view.character.id,
          set: { extraFields: [...view.character.extraFields, field.key] },
        },
      ],
    });
  }

  /** Makes the field and shows it on this character, as one change that undoes together. */
  function create(field: FieldDefinition): void {
    close();
    void actions.run({
      commands: [
        { type: "field.create", field },
        {
          type: "character.update",
          id: view.character.id,
          set: { extraFields: [...view.character.extraFields, field.key] },
        },
      ],
    });
  }

  function focus(node: HTMLElement): void {
    node.focus();
  }
</script>

<div class="ctl-wrap">
  <button
    bind:this={trigger}
    type="button"
    class="ghost"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => {
      open = !open;
      creating = false;
      query = "";
    }}
  >
    <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
    Add a field
  </button>

  {#if open}
    <Popover label="Add a field" role="dialog" anchor={trigger} onclose={close}>
      {#if !creating}
        <div class="pad">
          <input
            type="text"
            class="ctl"
            aria-label="Search fields"
            placeholder="Search fields"
            bind:value={query}
            use:focus
          />
        </div>
        <div role="listbox" aria-label="Fields" class="list">
          {#each matches as field (field.key)}
            <button
              type="button"
              role="option"
              aria-selected="false"
              class="ctl-item"
              onclick={() => add(field)}
            >
              {field.label}
            </button>
          {/each}
        </div>
        {#if canCreate}
          <button type="button" class="ctl-item" onclick={() => (creating = true)}>
            Create "{query.trim()}"
          </button>
        {/if}
        <div class="ctl-separator" role="separator"></div>
        <button
          type="button"
          class="ctl-item"
          onclick={() => {
            close();
            actions.openTab("fields");
          }}
        >
          Manage fields…
        </button>
      {:else}
        <FieldForm
          name={query.trim()}
          takenKeys={new Set(library.map((f) => f.key))}
          onsubmit={create}
          oncancel={() => (creating = false)}
        />
      {/if}
    </Popover>
  {/if}
</div>

<style>
  .ghost {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--color-text-secondary);
  }

  .ghost:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .pad {
    padding: var(--space-1);
  }

  .list {
    max-height: calc(var(--size-control) * 7);
    overflow: auto;
  }
</style>
