<script lang="ts">
  import { untrack } from "svelte";
  import type { Crop } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";
  import Dialog from "../components/Dialog.svelte";
  import { cropToPixels, largestCentredCrop, moveCrop, resizeCrop } from "./crop.ts";

  let {
    name,
    src,
    initial,
    replacing,
    onsave,
    oncancel,
  }: {
    name: string;
    /** The image to crop: a chosen file, or the character's current original. */
    src: string;
    /** The crop to start from; null starts with the largest centred circle. */
    initial: Crop | null;
    /** True when the character already has a photo this will replace. */
    replacing: boolean;
    onsave: (crop: Crop) => void;
    oncancel: () => void;
  } = $props();

  /** The image is fitted in a square this many pixels across. */
  const FRAME = 360;
  const NUDGE = 0.01;
  const BIG_NUDGE = 0.1;

  let natural = $state.raw<{ width: number; height: number } | null>(null);
  let crop = $state.raw<Crop | null>(untrack(() => initial));

  /** Display pixels per image pixel. */
  const scale = $derived(natural ? FRAME / Math.max(natural.width, natural.height) : 1);
  const circle = $derived(
    natural && crop
      ? (() => {
          const px = cropToPixels(crop, natural.width, natural.height);
          return {
            left: px.left * scale,
            top: px.top * scale,
            side: px.side * scale,
          };
        })()
      : null,
  );

  function loaded(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    if (!image.naturalWidth || !image.naturalHeight) return;
    natural = { width: image.naturalWidth, height: image.naturalHeight };
    crop ??= largestCentredCrop(natural.width, natural.height);
  }

  function drag(event: PointerEvent): void {
    if (!natural || !crop) return;
    event.preventDefault();
    const { width, height } = natural;
    const shorter = Math.min(width, height);
    const start = crop;
    const [x0, y0] = [event.clientX, event.clientY];
    const move = (e: PointerEvent) => {
      // Display pixels to a fraction of the image's shorter side.
      crop = moveCrop(
        start,
        (e.clientX - x0) / scale / shorter,
        (e.clientY - y0) / scale / shorter,
        width,
        height,
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function key(event: KeyboardEvent): void {
    if (!natural || !crop) return;
    const step = event.shiftKey ? BIG_NUDGE : NUDGE;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    crop = moveCrop(crop, move[0], move[1], natural.width, natural.height);
  }

  function zoom(event: Event): void {
    if (!natural || !crop) return;
    const value = Number((event.currentTarget as HTMLInputElement).value);
    crop = resizeCrop(crop, 1 / value, natural.width, natural.height);
  }
</script>

<Dialog
  title="Crop {name}'s photo"
  subtitle={replacing ? `This replaces ${name}'s current photo.` : undefined}
  width={FRAME + 60}
  placement="top"
  onclose={oncancel}
>
  <div class="stage" style:width="{FRAME}px" style:height="{FRAME}px">
    <div
      class="frame"
      style:width="{natural ? natural.width * scale : FRAME}px"
      style:height="{natural ? natural.height * scale : FRAME}px"
    >
      <img {src} alt="" draggable="false" onload={loaded} />
      {#if circle}
        <button
          type="button"
          class="circle"
          aria-label="Crop area"
          style:left="{circle.left}px"
          style:top="{circle.top}px"
          style:width="{circle.side}px"
          style:height="{circle.side}px"
          onpointerdown={drag}
          onkeydown={key}
        ></button>
      {/if}
    </div>
  </div>
  <label class="zoom">
    <span>Zoom</span>
    <input
      type="range"
      aria-label="Zoom"
      min="1"
      max="10"
      step="0.05"
      value={crop ? 1 / crop.size : 1}
      disabled={!crop}
      oninput={zoom}
    />
  </label>
  <div class="buttons">
    <Button onclick={oncancel}>Cancel</Button>
    <Button variant="primary" disabled={!crop} onclick={() => crop && onsave(crop)}>Save</Button>
  </div>
</Dialog>

<style>
  .stage {
    display: grid;
    place-items: center;
    margin: 0 auto;
    background: var(--color-fill);
    border-radius: var(--radius-control);
    overflow: hidden;
  }

  .frame {
    position: relative;
    overflow: hidden;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }

  .circle {
    position: absolute;
    padding: 0;
    border: none;
    background: none;
    border-radius: 50%;
    cursor: grab;
    /* The ring, then everything outside it dimmed. */
    box-shadow:
      0 0 0 2px var(--color-on-accent),
      0 0 0 9999px var(--color-scrim);
    touch-action: none;
  }

  .circle:active {
    cursor: grabbing;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .zoom input {
    flex: 1;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
</style>
