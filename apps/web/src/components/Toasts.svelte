<script lang="ts">
  import { settleIn, settleOut } from "../lib/motion.ts";
  import { toasts } from "../lib/toasts.svelte.ts";
</script>

<div class="toasts" role="status" aria-live="polite">
  {#if toasts.current}
    {#key toasts.current.id}
      <p
        class="toast"
        in:settleIn={{ origin: "bottom center" }}
        out:settleOut={{ origin: "bottom center" }}
      >
        {toasts.current.message}
      </p>
    {/key}
  {/if}
</div>

<style>
  .toasts {
    position: absolute;
    bottom: var(--space-3);
    left: 50%;
    z-index: 80;
    translate: -50% 0;
    pointer-events: none;
  }

  .toast {
    max-width: 520px;
    margin: 0;
    padding: 6px var(--space-3);
    border-radius: var(--radius-menu);
    background: var(--color-text);
    color: var(--color-page);
    box-shadow: var(--shadow-floating);
  }
</style>
