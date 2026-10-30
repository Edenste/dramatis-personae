<script lang="ts">
  import { Minus, Plus, X } from "@lucide/svelte";
  import {
    FIELD_TYPES,
    generateId,
    type CharacterFile,
    type FieldDefinition,
    type FieldsFile,
    type RolesFile,
    type Template,
    type TemplatesFile,
  } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";
  import ConfirmDialog from "../components/ConfirmDialog.svelte";
  import IconButton from "../components/IconButton.svelte";
  import Popover from "../components/Popover.svelte";
  import SortableList from "../components/SortableList.svelte";
  import Switch from "../components/Switch.svelte";
  import type { WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import FieldForm from "../profile/FieldForm.svelte";

  // `state` is aliased: a variable named `state` would make `$state` read as a store.
  let { state: world, actions }: { state: WorldState; actions: ProfileActions } = $props();

  const TYPE_NAMES: Record<FieldDefinition["type"], string> = {
    text: "Text",
    number: "Number",
    measurement: "Measurement",
    date: "Date",
    colour: "Colour",
    select: "Select",
    multiselect: "Multi-select",
    character: "Character",
  };

  type Selection = { kind: "field" | "template"; key: string } | null;
  interface Ask {
    title: string;
    message: string;
    confirm: string;
    action: () => void;
  }

  let selection = $state<Selection>(null);
  let ask = $state<Ask | null>(null);
  let creatingField = $state(false);
  /** The plus button's wrapper, so pressing the button again counts as inside the popover's anchor. */
  let newFieldAnchor: HTMLElement | undefined = $state();
  let newOption = $state("");

  const library = $derived(
    (world.files.get("fields")?.data as FieldsFile | undefined) ?? { subtitle: null, fields: [] },
  );
  const templates = $derived(
    (world.files.get("templates")?.data as TemplatesFile | undefined) ?? { templates: [] },
  );
  const roles = $derived((world.files.get("roles")?.data as RolesFile | undefined)?.roles ?? []);
  const characters = $derived(
    [...world.files.values()]
      .filter((file) => file.ref.kind === "character")
      .map((file) => file.data as CharacterFile),
  );

  // A selection that points at something not there (yet, or any more) just shows nothing.
  const field = $derived(
    selection?.kind === "field" ? library.fields.find((f) => f.key === selection!.key) : undefined,
  );
  const template = $derived(
    selection?.kind === "template"
      ? templates.templates.find((t) => t.id === selection!.key)
      : undefined,
  );

  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
  const countOf = (matching: (c: CharacterFile) => boolean) => characters.filter(matching).length;
  const holders = (key: string) => countOf((c) => c.fields[key] !== undefined);
  const optionUsers = (key: string, option: string) =>
    countOf((c) => {
      const value = c.fields[key];
      return Array.isArray(value) ? value.includes(option) : value === option;
    });

  const run = (...commands: Parameters<ProfileActions["run"]>[0]["commands"]) =>
    void actions.run({ commands });
  const updateField = (key: string, set: Record<string, unknown>) =>
    run({ type: "field.update", key, set } as never);
  const updateTemplate = (id: string, set: Record<string, unknown>) =>
    run({ type: "template.update", id, set } as never);

  /** Saves a text box's content when it is left or Enter is pressed, if it changed and isn't empty. */
  function commitName(event: Event, current: string, save: (name: string) => void): void {
    const input = event.currentTarget as HTMLInputElement;
    const next = input.value.trim();
    if (next === "" || next === current) input.value = current;
    else save(next);
  }

  function removeOption(f: FieldDefinition, option: string): void {
    const options = (f.options ?? []).filter((o) => o !== option);
    const users = optionUsers(f.key, option);
    const go = () => updateField(f.key, { options });
    if (users === 0) return go();
    ask = {
      title: `Remove '${option}' from ${f.label}?`,
      message: `${users} ${plural(users, "character", "characters")} will have it cleared.`,
      confirm: "Remove",
      action: go,
    };
  }

  function addOption(f: FieldDefinition): void {
    const option = newOption.trim();
    if (option === "" || (f.options ?? []).includes(option)) return;
    newOption = "";
    updateField(f.key, { options: [...(f.options ?? []), option] });
  }

  function deleteField(f: FieldDefinition): void {
    const users = holders(f.key);
    ask = {
      title: `Delete ${f.label}?`,
      message:
        users === 0
          ? "No characters have a value."
          : `${users} ${plural(users, "character will", "characters will")} lose their value.`,
      confirm: "Delete",
      action: () => run({ type: "field.delete", key: f.key }),
    };
  }

  function deleteTemplate(t: Template): void {
    const users = countOf((c) => c.templates.includes(t.id));
    ask = {
      title: `Delete the ${t.name} template?`,
      message: `${users} ${plural(users, "character uses", "characters use")} it. Their values are kept.`,
      confirm: "Delete",
      action: () => run({ type: "template.delete", id: t.id }),
    };
  }

  function createTemplate(): void {
    const id = generateId();
    run({ type: "template.create", template: { id, name: "New template" } });
    selection = { kind: "template", key: id };
  }

  function toggleTemplateField(t: Template, key: string, on: boolean): void {
    const keep = on ? [...t.fields, key] : t.fields.filter((k) => k !== key);
    // The library's order decides how a template's fields are listed.
    updateTemplate(t.id, {
      fields: library.fields.map((f) => f.key).filter((k) => keep.includes(k)),
    });
  }
</script>

<div class="page">
  <aside class="sidebar">
    <section>
      <h2>Fields</h2>
      <SortableList
        items={library.fields}
        key={(f: FieldDefinition) => f.key}
        name={(f: FieldDefinition) => f.label}
        selected={selection?.kind === "field" ? selection.key : null}
        disabled={!actions.canEdit}
        onselect={(key: string) => (selection = { kind: "field", key })}
        onmove={(key: string, index: number) => run({ type: "field.move", key, index })}
      >
        {#snippet row(item: FieldDefinition)}{item.label}{/snippet}
      </SortableList>
      {#if actions.canEdit}
        <div class="foot">
          <span class="anchor" bind:this={newFieldAnchor}>
            <IconButton label="Add a field" onclick={() => (creatingField = !creatingField)}>
              <Plus size={14} strokeWidth={1.5} />
            </IconButton>
            {#if creatingField}
              <Popover
                label="New field"
                role="dialog"
                anchor={newFieldAnchor}
                onclose={() => (creatingField = false)}
              >
                <FieldForm
                  name=""
                  takenKeys={new Set(library.fields.map((f) => f.key))}
                  onsubmit={(created: FieldDefinition) => {
                    creatingField = false;
                    run({ type: "field.create", field: created });
                    selection = { kind: "field", key: created.key };
                  }}
                  oncancel={() => (creatingField = false)}
                />
              </Popover>
            {/if}
          </span>
          <IconButton
            label={field ? `Delete ${field.label}` : "Delete the selected field"}
            disabled={!field}
            onclick={() => field && deleteField(field)}
          >
            <Minus size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
      {/if}
    </section>

    <section>
      <h2>Templates</h2>
      <SortableList
        items={templates.templates}
        key={(t: Template) => t.id}
        name={(t: Template) => t.name}
        selected={selection?.kind === "template" ? selection.key : null}
        disabled={!actions.canEdit}
        onselect={(key: string) => (selection = { kind: "template", key })}
        onmove={(key: string, index: number) => run({ type: "template.move", id: key, index })}
      >
        {#snippet row(item: Template)}{item.name}{/snippet}
      </SortableList>
      {#if actions.canEdit}
        <div class="foot">
          <IconButton label="Add a template" onclick={createTemplate}>
            <Plus size={14} strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label={template ? `Delete ${template.name}` : "Delete the selected template"}
            disabled={!template}
            onclick={() => template && deleteTemplate(template)}
          >
            <Minus size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
      {/if}
    </section>
  </aside>

  <main class="detail">
    {#if field}
      {@const f = field}
      {@const users = holders(f.key)}
      <div class="settings">
        <div class="setting">
          <span class="name">Name</span>
          <input
            type="text"
            aria-label="Name"
            value={f.label}
            disabled={!actions.canEdit}
            onblur={(e) => commitName(e, f.label, (label) => updateField(f.key, { label }))}
            onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>
        <div class="setting">
          <span class="name">Type</span>
          <div class="stack">
            <select
              aria-label="Type"
              value={f.type}
              disabled={!actions.canEdit || users > 0}
              onchange={(e) => updateField(f.key, { type: e.currentTarget.value })}
            >
              {#each FIELD_TYPES as type (type)}
                <option value={type}>{TYPE_NAMES[type]}</option>
              {/each}
            </select>
            {#if users > 0}
              <p class="note">
                {users}
                {plural(users, "character has a value", "characters have a value")}, so the type
                can't change.
              </p>
            {/if}
          </div>
        </div>
        {#if f.type === "measurement"}
          <div class="setting">
            <span class="name">Unit</span>
            <input
              type="text"
              aria-label="Unit"
              value={f.unit ?? ""}
              disabled={!actions.canEdit}
              onblur={(e) => {
                const unit = e.currentTarget.value.trim();
                if (unit !== (f.unit ?? ""))
                  updateField(f.key, { unit: unit === "" ? null : unit });
              }}
              onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </div>
        {/if}
        {#if f.type === "select" || f.type === "multiselect"}
          <div class="setting">
            <span class="name">Options</span>
            <div class="stack">
              <ul class="options">
                {#each f.options ?? [] as option (option)}
                  <li>
                    <span>{option}</span>
                    {#if actions.canEdit}
                      <IconButton
                        label="Remove option {option}"
                        onclick={() => removeOption(f, option)}
                      >
                        <X size={14} strokeWidth={1.5} />
                      </IconButton>
                    {/if}
                  </li>
                {/each}
              </ul>
              {#if actions.canEdit}
                <input
                  type="text"
                  aria-label="New option"
                  placeholder="Add an option"
                  bind:value={newOption}
                  onkeydown={(e) => e.key === "Enter" && addOption(f)}
                />
              {/if}
            </div>
          </div>
        {/if}
        <div class="setting">
          <span class="name">Shown on every character</span>
          <Switch
            label="Shown on every character"
            checked={f.default}
            disabled={!actions.canEdit}
            onchange={(on: boolean) => updateField(f.key, { default: on })}
          />
        </div>
        <div class="setting">
          <span class="name">Show under the name</span>
          <Switch
            label="Show under the name"
            checked={library.subtitle === f.key}
            disabled={!actions.canEdit}
            onchange={(on: boolean) => run({ type: "fields.setSubtitle", key: on ? f.key : null })}
          />
        </div>
        {#if actions.canEdit}
          <div class="setting">
            <span class="name"></span>
            <Button variant="danger" onclick={() => deleteField(f)}>Delete field…</Button>
          </div>
        {/if}
      </div>
    {:else if template}
      {@const t = template}
      <div class="settings">
        <div class="setting">
          <span class="name">Name</span>
          <input
            type="text"
            aria-label="Name"
            value={t.name}
            disabled={!actions.canEdit}
            onblur={(e) => commitName(e, t.name, (name) => updateTemplate(t.id, { name }))}
            onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>
        <div class="setting">
          <span class="name">Fields</span>
          <ul class="checks">
            {#each library.fields as f (f.key)}
              <li>
                <label>
                  <input
                    type="checkbox"
                    aria-label={f.label}
                    checked={t.fields.includes(f.key)}
                    disabled={!actions.canEdit}
                    onchange={(e) => toggleTemplateField(t, f.key, e.currentTarget.checked)}
                  />
                  {f.label}
                </label>
              </li>
            {/each}
          </ul>
        </div>
        <div class="setting">
          <span class="name">Role</span>
          <select
            aria-label="Role"
            value={t.role ?? ""}
            disabled={!actions.canEdit}
            onchange={(e) => updateTemplate(t.id, { role: e.currentTarget.value || null })}
          >
            <option value="">None</option>
            {#each roles as role (role.id)}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
        </div>
        {#if actions.canEdit}
          <div class="setting">
            <span class="name"></span>
            <Button variant="danger" onclick={() => deleteTemplate(t)}>Delete template…</Button>
          </div>
        {/if}
      </div>
    {:else}
      <p class="empty">Select a field or template.</p>
    {/if}
  </main>
</div>

{#if ask}
  {@const pending = ask}
  <ConfirmDialog
    title={pending.title}
    message={pending.message}
    confirm={pending.confirm}
    onconfirm={() => {
      const { action } = pending;
      ask = null;
      action();
    }}
    oncancel={() => (ask = null)}
  />
{/if}

<style>
  .page {
    display: grid;
    grid-template-columns: 240px 1fr;
    height: 100%;
  }

  .sidebar {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    padding: var(--space-3);
    overflow: auto;
    border-right: 1px solid var(--color-hairline);
  }

  h2 {
    margin: 0 0 var(--space-1);
    padding: 0 var(--space-2);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
  }

  .foot {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-1);
  }

  .anchor {
    position: relative;
  }

  .detail {
    padding: var(--space-5);
    overflow: auto;
  }

  .settings {
    display: grid;
    gap: var(--space-3);
    max-width: 480px;
  }

  .setting {
    display: grid;
    grid-template-columns: 160px 1fr;
    align-items: start;
    gap: var(--space-3);
  }

  .name {
    padding-top: var(--space-1);
    color: var(--color-text-secondary);
  }

  .stack {
    display: grid;
    gap: var(--space-2);
  }

  input[type="text"],
  select {
    width: 100%;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: var(--color-page);
    box-shadow: inset 0 0 0 1px var(--color-outline);
  }

  input[type="text"]:focus,
  select:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--color-accent-stroke);
  }

  input:disabled,
  select:disabled {
    color: var(--color-text-disabled);
  }

  .note {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .options,
  .checks {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .options li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: var(--space-2);
  }

  .checks label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-control);
  }

  .empty {
    margin: 0;
    color: var(--color-text-secondary);
  }
</style>
