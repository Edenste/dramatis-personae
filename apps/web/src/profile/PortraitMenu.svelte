<script lang="ts">
  import { Check, ChevronRight, Pencil } from "@lucide/svelte";
  import { PORTRAIT_UPLOAD_LIMIT, type Crop } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";
  import ColourSwatches from "../components/ColourSwatches.svelte";
  import Dialog from "../components/Dialog.svelte";
  import Popover from "../components/Popover.svelte";
  import { originalUrl } from "../lib/portraits.ts";
  import { toasts } from "../lib/toasts.svelte.ts";
  import "./controls/controls.css";
  import type { ProfileActions } from "./actions.ts";
  import CropSheet from "./CropSheet.svelte";
  import type { ProfileView } from "./profile-view.ts";

  let {
    view,
    actions,
    compact = false,
  }: {
    view: ProfileView;
    actions: ProfileActions;
    /** A smaller pencil, for the card's smaller portrait. */
    compact?: boolean;
  } = $props();

  /** What the crop sheet is showing: a file just chosen, or the current photo. */
  interface Sheet {
    src: string;
    /** The chosen file's bytes; absent when adjusting the crop of the current photo. */
    bytes?: Uint8Array;
    initial: Crop | null;
    /** A blob address to release when the sheet closes. */
    revoke?: string;
  }

  let open = $state(false);
  let panel = $state<"main" | "colour">("main");
  let trigger: HTMLButtonElement | undefined = $state();
  let picker: HTMLInputElement | undefined = $state();
  let sheet = $state.raw<Sheet | null>(null);
  let confirmRemove = $state(false);

  const name = $derived(view.character.name);
  const id = $derived(view.character.id);
  const photo = $derived(view.character.portrait);

  const patch = (set: Record<string, unknown>) =>
    void actions.run({ commands: [{ type: "character.update", id, set }] });

  function close(): void {
    open = false;
    panel = "main";
  }

  /** Reads a chosen or dropped file and opens the crop sheet on it. */
  async function choose(file: File): Promise<void> {
    if (file.size > PORTRAIT_UPLOAD_LIMIT) {
      toasts.show("Images must be under 20 MB.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = URL.createObjectURL(file);
    sheet = { src, bytes, initial: null, revoke: src };
  }

  function closeSheet(): void {
    if (sheet?.revoke) URL.revokeObjectURL(sheet.revoke);
    sheet = null;
  }

  async function saveSheet(crop: Crop): Promise<void> {
    const current = sheet;
    if (!current) return;
    if (current.bytes) {
      // A new photo overwrites the old one, so nothing is sent until Save.
      if (await actions.setPortrait(id, current.bytes, crop)) closeSheet();
    } else if (photo) {
      patch({ portrait: { file: photo.file, crop } });
      closeSheet();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="menu"
  class:compact
  ondragover={(event) => event.preventDefault()}
  ondrop={(event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) void choose(file);
  }}
>
  <button
    bind:this={trigger}
    type="button"
    class="pencil"
    aria-label="Change {name}'s photo"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => {
      open = !open;
      panel = "main";
    }}
  >
    <Pencil size={12} strokeWidth={1.5} aria-hidden="true" />
  </button>

  {#if open}
    <Popover label="Photo" anchor={trigger} onclose={close}>
      {#if panel === "main"}
        <button
          type="button"
          role="menuitem"
          class="ctl-item"
          onclick={() => {
            close();
            picker?.click();
          }}
        >
          Change photo…
        </button>
        {#if photo}
          <button
            type="button"
            role="menuitem"
            class="ctl-item"
            onclick={() => {
              close();
              sheet = {
                src: originalUrl(actions.worldId, photo.file, view.fingerprint),
                initial: photo.crop,
              };
            }}
          >
            Adjust crop…
          </button>
          <button
            type="button"
            role="menuitem"
            class="ctl-item danger"
            onclick={() => {
              close();
              confirmRemove = true;
            }}
          >
            Remove photo
          </button>
        {/if}
        <div class="ctl-separator" role="separator"></div>
        <button
          type="button"
          role="menuitem"
          class="ctl-item"
          aria-haspopup="menu"
          onclick={() => (panel = "colour")}
        >
          Colour
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      {:else}
        <button type="button" role="menuitem" class="ctl-item" onclick={() => (panel = "main")}>
          Back
        </button>
        <div class="ctl-separator" role="separator"></div>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={view.character.color === null}
          class="ctl-item"
          onclick={() => {
            close();
            patch({ color: null });
          }}
        >
          <span class="auto">
            Automatic
            {#if view.character.color === null}<small>{view.colorReason}</small>{/if}
          </span>
          {#if view.character.color === null}<Check
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
            />{/if}
        </button>
        <ColourSwatches
          value={view.character.color}
          onpick={(hex: string) => {
            close();
            patch({ color: hex });
          }}
        />
      {/if}
    </Popover>
  {/if}

  <input
    bind:this={picker}
    type="file"
    class="ctl-sr"
    tabindex="-1"
    aria-hidden="true"
    accept=".jpg,.jpeg,.png,.webp,.gif,.avif"
    onchange={(event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = "";
      if (file) void choose(file);
    }}
  />
</div>

{#if sheet}
  <CropSheet
    {name}
    src={sheet.src}
    initial={sheet.initial}
    replacing={sheet.bytes !== undefined && photo !== undefined}
    onsave={(crop: Crop) => void saveSheet(crop)}
    oncancel={closeSheet}
  />
{/if}

{#if confirmRemove}
  <Dialog title="Remove {name}'s photo?" onclose={() => (confirmRemove = false)}>
    <p class="warning">This can't be undone.</p>
    <div class="buttons">
      <Button onclick={() => (confirmRemove = false)}>Cancel</Button>
      <Button
        variant="danger"
        onclick={() => {
          confirmRemove = false;
          void actions.removePortrait(id);
        }}
      >
        Remove
      </Button>
    </div>
  </Dialog>
{/if}

<style>
  .menu {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .pencil {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-text-secondary);
    box-shadow: 0 0 0 1px var(--color-outline);
  }

  .compact .pencil {
    width: 18px;
    height: 18px;
  }

  .pencil:hover {
    color: var(--color-text);
  }

  .ctl-item.danger {
    color: var(--color-danger);
  }

  .ctl-item.danger:hover {
    color: var(--color-on-accent);
  }

  .auto {
    display: grid;
    text-align: left;
  }

  small {
    font-size: var(--text-xs);
    opacity: 0.8;
  }

  .warning {
    margin: 0 0 var(--space-4);
    color: var(--color-text-secondary);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
