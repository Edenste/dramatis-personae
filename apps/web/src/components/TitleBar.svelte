<script lang="ts">
  import { Settings } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import IconButton from "./IconButton.svelte";

  let {
    windowControls,
    onsettings,
    children,
    actions,
  }: {
    /** Where the desktop app's window buttons sit; null in a browser. */
    windowControls: "left" | "right" | null;
    onsettings: () => void;
    /** The world menu and tabs; left out on first run and error screens. */
    children?: Snippet;
    /** Undo, redo and the problems badge, before the gear. */
    actions?: Snippet;
  } = $props();
</script>

<header
  class="titlebar"
  class:left={windowControls === "left"}
  class:right={windowControls === "right"}
>
  <div class="start">
    {@render children?.()}
  </div>
  <div class="end">
    {@render actions?.()}
    <IconButton label="Settings" onclick={onsettings}>
      <Settings size={16} strokeWidth={1.5} />
    </IconButton>
  </div>
</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-titlebar);
    padding: 0 var(--space-2);
    -webkit-app-region: drag;
  }

  /* Room for the macOS window buttons, or the Windows and Linux ones. */
  .left {
    padding-left: 78px;
  }

  .right {
    padding-right: 138px;
  }

  .start {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  .end {
    display: flex;
    align-items: center;
    gap: 2px;
    -webkit-app-region: no-drag;
  }
</style>
