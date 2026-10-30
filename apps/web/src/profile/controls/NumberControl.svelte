<script lang="ts">
  import { untrack } from "svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { value, label, onchange, onclear }: ControlProps = $props();

  const text = $derived(typeof value === "number" ? String(value) : "");
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
    if (Number.isFinite(number)) onchange(number);
    else draft = text; // not a number: put back what was there
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
</label>
