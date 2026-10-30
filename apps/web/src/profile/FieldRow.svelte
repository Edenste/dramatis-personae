<script lang="ts">
  import { Minus } from "@lucide/svelte";
  import CharacterLink from "../components/CharacterLink.svelte";
  import IconButton from "../components/IconButton.svelte";
  import { portraitSrc } from "../lib/portraits.ts";
  import type { CharacterSummary, WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "./actions.ts";
  import CharacterControl from "./controls/CharacterControl.svelte";
  import ColourControl from "./controls/ColourControl.svelte";
  import DateControl from "./controls/DateControl.svelte";
  import MeasurementControl from "./controls/MeasurementControl.svelte";
  import MultiSelectControl from "./controls/MultiSelectControl.svelte";
  import NumberControl from "./controls/NumberControl.svelte";
  import SelectControl from "./controls/SelectControl.svelte";
  import TextControl from "./controls/TextControl.svelte";
  import { formatValue } from "./format.ts";
  import type { ProfileView, FieldRow } from "./profile-view.ts";

  let {
    row,
    view,
    state,
    characters,
    editing,
    actions,
  }: {
    row: FieldRow;
    view: ProfileView;
    state: WorldState;
    characters: CharacterSummary[];
    editing: boolean;
    actions: ProfileActions;
  } = $props();

  const field = $derived(row.field);
  const id = $derived(view.character.id);

  const source = $derived(
    row.source === "default"
      ? "Shown on every character"
      : row.source === "template"
        ? `From the ${row.template ?? ""} template`
        : undefined,
  );

  const save = (value: unknown) =>
    void actions.run({
      commands: [{ type: "character.update", id, setFields: { [field.key]: value } }],
    });
  const clear = () =>
    void actions.run({ commands: [{ type: "character.update", id, unsetFields: [field.key] }] });
  const removeFromCharacter = () =>
    void actions.run({
      commands: [
        {
          type: "character.update",
          id,
          set: { extraFields: view.character.extraFields.filter((k) => k !== field.key) },
        },
      ],
    });

  const linked = $derived(
    typeof row.value === "string" ? (characters.find((c) => c.id === row.value) ?? null) : null,
  );
</script>

<div class="row" class:editing>
  <span class="label" title={source}>{field.label}</span>
  <div class="value">
    {#if editing}
      {@const props = {
        field,
        value: row.value,
        label: field.label,
        onchange: save,
        onclear: clear,
      }}
      {#if field.type === "text"}
        <TextControl {...props} />
      {:else if field.type === "number"}
        <NumberControl {...props} />
      {:else if field.type === "measurement"}
        <MeasurementControl {...props} />
      {:else if field.type === "select"}
        <SelectControl {...props} />
      {:else if field.type === "multiselect"}
        <MultiSelectControl {...props} />
      {:else if field.type === "date"}
        <DateControl {...props} />
      {:else if field.type === "colour"}
        <ColourControl {...props} />
      {:else}
        <CharacterControl {...props} {characters} />
      {/if}
    {:else if field.type === "character"}
      <CharacterLink
        character={linked}
        label="Deleted character"
        onopen={(character: string) => actions.openCharacter(character)}
        thumbnail={linked ? portraitSrc(state, actions.worldId, linked.id) : null}
      />
    {:else if field.type === "colour"}
      <span class="colour">
        <span class="swatch" style:--swatch={String(row.value)}></span>
        {row.value}
      </span>
    {:else}
      <span class="text tabular">{formatValue(field, row.value)}</span>
    {/if}
  </div>
  {#if editing && row.source === "extra"}
    <span class="remove">
      <IconButton
        label="Remove {field.label} from {view.character.name}"
        onclick={removeFromCharacter}
      >
        <Minus size={14} strokeWidth={1.5} />
      </IconButton>
    </span>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: start;
    gap: var(--space-3);
    min-height: var(--size-control);
  }

  .row.editing {
    grid-template-columns: 110px 1fr var(--size-control);
    align-items: center;
  }

  .label {
    padding-top: var(--space-1);
    color: var(--color-text-secondary);
  }

  .row.editing .label {
    padding-top: 0;
  }

  .value {
    min-width: 0;
    padding-top: var(--space-1);
    overflow-wrap: anywhere;
  }

  .row.editing .value {
    padding-top: 0;
  }

  .text {
    white-space: pre-wrap;
  }

  .colour {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px var(--color-outline);
  }

  .remove {
    opacity: 0;
    transition: opacity var(--motion-hover);
  }

  .row:hover .remove,
  .row:focus-within .remove {
    opacity: 1;
  }
</style>
