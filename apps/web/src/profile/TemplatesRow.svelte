<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import Popover from "../components/Popover.svelte";
  import "./controls/controls.css";
  import type { ProfileActions } from "./actions.ts";
  import type { ProfileView } from "./profile-view.ts";

  let { view, actions }: { view: ProfileView; actions: ProfileActions } = $props();

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  const setTemplates = (templates: string[]) =>
    void actions.run({
      commands: [{ type: "character.update", id: view.character.id, set: { templates } }],
    });
</script>

<div class="templates">
  <span class="label">Templates</span>
  <ul class="ctl-chips">
    {#each view.templates as template (template.id)}
      <li class="ctl-chip">
        {template.name}
        <button
          type="button"
          aria-label="Remove the {template.name} template"
          onclick={() => setTemplates(view.character.templates.filter((t) => t !== template.id))}
        >
          <X size={12} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </li>
    {/each}
  </ul>
  {#if view.otherTemplates.length > 0}
    <div class="ctl-wrap">
      <button
        bind:this={trigger}
        type="button"
        class="ctl-add"
        aria-label="Add a template"
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={() => (open = !open)}
      >
        <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {#if open}
        <Popover label="Templates" anchor={trigger} onclose={() => (open = false)}>
          {#each view.otherTemplates as template (template.id)}
            <button
              type="button"
              role="menuitem"
              class="ctl-item"
              onclick={() => {
                open = false;
                setTemplates([...view.character.templates, template.id]);
              }}
            >
              {template.name}
            </button>
          {/each}
        </Popover>
      {/if}
    </div>
  {/if}
</div>

<style>
  .templates {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .label {
    color: var(--color-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
