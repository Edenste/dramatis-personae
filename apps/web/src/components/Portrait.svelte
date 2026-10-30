<script lang="ts">
  import { User } from "@lucide/svelte";

  let {
    color,
    size,
    src = null,
    label,
  }: {
    /** The ring's colour: the character's. */
    color: string;
    /** Diameter in pixels. */
    size: number;
    /** The thumbnail; a missing or broken one shows the silhouette. */
    src?: string | null;
    /** Names the portrait for assistive technology; leave out when a name sits beside it. */
    label?: string;
  } = $props();

  let failed = $state(false);

  // A new image gets a fresh try.
  $effect(() => {
    void src;
    failed = false;
  });
</script>

<span
  class="portrait"
  style:--ring={color}
  style:--size="{size}px"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  {#if src && !failed}
    <img {src} alt="" onerror={() => (failed = true)} />
  {:else}
    <User size={Math.round(size * 0.55)} strokeWidth={1.5} aria-hidden="true" />
  {/if}
</span>

<style>
  .portrait {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    overflow: hidden;
    border: max(1.5px, calc(var(--size) * 0.045)) solid var(--ring, var(--color-character-default));
    border-radius: 50%;
    background: var(--color-fill);
    color: var(--color-text-secondary);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
