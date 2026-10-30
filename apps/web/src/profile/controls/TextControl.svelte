<script lang="ts">
  import { untrack } from "svelte";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { value, label, onchange, onclear }: ControlProps = $props();

  const text = $derived(typeof value === "string" ? value : "");
  let draft = $state(untrack(() => text));
  let focused = $state(false);
  let box: HTMLTextAreaElement | undefined = $state();

  // A change made elsewhere shows up, unless it would wipe what is being typed.
  $effect(() => {
    const next = text;
    if (!untrack(() => focused)) draft = next;
  });

  /** Grows the box to fit browsers without `field-sizing`. */
  function fit(): void {
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }

  $effect(() => {
    void draft;
    fit();
  });

  /** What was last sent, so Enter followed by a blur doesn't send it twice before the reply lands. */
  let sent: string | null = null;

  function commit(): void {
    const next = draft.trim();
    if (next === text) {
      draft = text;
      return;
    }
    if (next === sent) return;
    sent = next;
    if (next === "") {
      draft = "";
      if (value !== undefined) onclear();
      return;
    }
    draft = next;
    onchange(next);
  }
</script>

<label class="ctl">
  <textarea
    bind:this={box}
    rows="1"
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
      // Enter finishes; Shift+Enter starts another line.
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      }
    }}></textarea>
</label>
