<script lang="ts">
  import { untrack } from "svelte";
  import { FIELD_TYPES, fieldKeyFor, type FieldDefinition } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";
  import "./controls/controls.css";

  let {
    name: initialName,
    takenKeys,
    onsubmit,
    oncancel,
  }: {
    /** The name to start with. */
    name: string;
    /** Keys the library already has, so the new one's key is free. */
    takenKeys: ReadonlySet<string>;
    /** The new field, with its generated key. Not a default field. */
    onsubmit: (field: FieldDefinition) => void;
    oncancel: () => void;
  } = $props();

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

  let name = $state(untrack(() => initialName));
  let type = $state<FieldDefinition["type"]>("text");
  let unit = $state("");
  let optionsText = $state("");

  const hasOptions = $derived(type === "select" || type === "multiselect");
  /** One option per line, without blanks or repeats. */
  const options = $derived(
    optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line, i, all) => line !== "" && all.indexOf(line) === i),
  );
  const ready = $derived(name.trim() !== "" && (!hasOptions || options.length > 0));

  function submit(): void {
    const label = name.trim();
    onsubmit({
      key: fieldKeyFor(label, takenKeys),
      label,
      type,
      default: false,
      ...(type === "measurement" && unit.trim() ? { unit: unit.trim() } : {}),
      ...(hasOptions ? { options } : {}),
    });
  }
</script>

<form
  class="form"
  onsubmit={(event) => {
    event.preventDefault();
    if (ready) submit();
  }}
>
  <label>
    <span>Name</span>
    <input class="ctl" aria-label="Field name" bind:value={name} />
  </label>
  <label>
    <span>Type</span>
    <select class="ctl" aria-label="Type" bind:value={type}>
      {#each FIELD_TYPES as kind (kind)}
        <option value={kind}>{TYPE_NAMES[kind]}</option>
      {/each}
    </select>
  </label>
  {#if type === "measurement"}
    <label>
      <span>Unit</span>
      <input class="ctl" aria-label="Unit" placeholder="For example EU or cm" bind:value={unit} />
    </label>
  {/if}
  {#if hasOptions}
    <label>
      <span>Options</span>
      <textarea
        class="ctl options"
        aria-label="Options"
        rows="3"
        placeholder="One option per line"
        bind:value={optionsText}></textarea>
    </label>
  {/if}
  <div class="buttons">
    <Button onclick={oncancel}>Cancel</Button>
    <Button variant="primary" type="submit" disabled={!ready}>Add field</Button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: var(--space-2);
    width: 260px;
    padding: var(--space-2);
  }

  label {
    display: grid;
    gap: var(--space-1);
  }

  label span {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .options {
    height: auto;
    padding: var(--space-1) var(--space-2);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
