<script lang="ts">
  import Button from "../components/Button.svelte";
  import { settleIn, settleOut } from "../lib/motion.ts";
  import { safeWebHref } from "./links.ts";

  let {
    x,
    y,
    onsubmit,
    onclose,
  }: {
    x: number;
    y: number;
    /** Called with an address that is safe to link to. */
    onsubmit: (href: string) => void;
    onclose: () => void;
  } = $props();

  let address = $state("");
  let refused = $state(false);
  let root: HTMLElement | undefined = $state();

  function submit(): void {
    const href = safeWebHref(address.trim());
    if (href) onsubmit(href);
    else refused = true;
  }

  function focus(node: HTMLElement): void {
    node.focus();
  }
</script>

<svelte:window
  onpointerdown={(event: PointerEvent) => {
    if (!root?.contains(event.target as Node)) onclose();
  }}
  onkeydown={(event: KeyboardEvent) => event.key === "Escape" && onclose()}
/>

<form
  bind:this={root}
  class="popover"
  style:left="{Math.max(8, Math.min(x, window.innerWidth - 288))}px"
  style:top="{Math.max(8, Math.min(y, window.innerHeight - 140))}px"
  aria-label="Add a link"
  in:settleIn={{ origin: "top left" }}
  out:settleOut={{ origin: "top left" }}
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <input
    type="text"
    aria-label="Link address"
    placeholder="https://"
    class:invalid={refused}
    bind:value={address}
    oninput={() => (refused = false)}
    use:focus
  />
  {#if refused}
    <p class="refused">Use a link starting with https://, http:// or mailto:</p>
  {/if}
  <div class="buttons">
    <Button variant="primary" type="submit">Add link</Button>
  </div>
</form>

<style>
  .popover {
    position: fixed;
    z-index: 120;
    display: grid;
    gap: var(--space-2);
    width: 280px;
    padding: var(--space-2);
    border-radius: var(--radius-menu);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
  }

  input {
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    background: var(--color-page);
    box-shadow: inset 0 0 0 1px var(--color-outline);
    outline: none;
  }

  input:focus {
    box-shadow: inset 0 0 0 1px var(--color-accent-stroke);
  }

  input.invalid {
    box-shadow: inset 0 0 0 1px var(--color-danger);
  }

  .refused {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--text-xs);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
  }
</style>
