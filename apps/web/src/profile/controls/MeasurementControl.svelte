<script lang="ts">
  import { untrack } from "svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { field, value, label, onchange, onclear }: ControlProps = $props();

  const stored = $derived(
    value !== null && typeof value === "object" ? (value as { value: number; unit: string }) : null,
  );
  const text = $derived(stored ? String(stored.value) : "");
  /** A value keeps the unit it was recorded in; an empty one shows the field's. */
  const unit = $derived(stored ? stored.unit : (field.unit ?? ""));

  let draft = $state(untrack(() => text));
  let focused = $state(false);

  $effect(() => {
    const next = text;
    if (!untrack(() => focused)) draft = next;
  });

  /** What was last sent, so Enter followed by a blur doesn't send it twice before the reply lands. */
  let sent: string | null = null;

  function commit(): void {
    const next = draft.trim();
    if (next === text || next === sent) return;
    sent = next;
    if (next === "") {
      if (value !== undefined) onclear();
      return;
    }
    const number = Number(next);
    // A changed number is recorded in the field's current unit.
    if (Number.isFinite(number)) onchange({ value: number, unit: field.unit ?? "" });
    else draft = text;
  }
</script>

<label class="ctl">
  <input
    type="text"
    inputmode="decimal"
    class="tabular"
    aria-label={label}
    placeholder="Empty"
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
  {#if unit}<span class="unit">{unit}</span>{/if}
</label>
