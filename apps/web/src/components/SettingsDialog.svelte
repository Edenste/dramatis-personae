<script lang="ts">
  import type { Settings, Status, Theme } from "@dramatis-personae/schema";
  import { unwrap, type Api } from "../lib/api.ts";
  import { applyTheme, resolveTheme } from "../lib/theme.ts";
  import { toasts } from "../lib/toasts.svelte.ts";
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";
  import FolderChange from "./FolderChange.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  let {
    api,
    settings,
    desktop,
    version,
    onclose,
    ontheme,
  }: {
    api: Api;
    settings: Settings;
    desktop: Status["desktop"];
    version: string;
    onclose: () => void;
    ontheme: (theme: Theme) => void;
  } = $props();

  let theme = $derived(settings.theme);

  const report = (error: unknown) =>
    toasts.show(error instanceof Error ? error.message : "Something went wrong. Try again.");

  async function chooseTheme(next: Theme): Promise<void> {
    theme = next;
    applyTheme(resolveTheme(next, window.matchMedia("(prefers-color-scheme: dark)").matches));
    ontheme(next);
    try {
      unwrap(await api.PUT("/api/settings", { body: { theme: next } }));
    } catch (error) {
      report(error);
    }
  }

  async function openFolder(): Promise<void> {
    try {
      unwrap(await api.POST("/api/data-folder/open"));
    } catch (error) {
      report(error);
    }
  }
</script>

<Dialog title="Settings" width={420} {onclose}>
  <div class="rows">
    <span class="label">Appearance</span>
    <SegmentedControl
      label="Appearance"
      value={theme}
      options={[
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
      onchange={(next: Theme) => void chooseTheme(next)}
    />

    <span class="label">Data folder</span>
    <div class="folder">
      <p class="path">{settings.dataRoot}</p>
      <div class="actions">
        <Button onclick={() => void openFolder()}>Open data folder</Button>
        <FolderChange {api} {desktop} />
      </div>
    </div>
  </div>
  <p class="version">Version {version}</p>
</Dialog>

<style>
  .rows {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: var(--space-4) var(--space-3);
    align-items: start;
  }

  .label {
    padding-top: 4px;
    color: var(--color-text-secondary);
  }

  .folder {
    display: grid;
    gap: var(--space-2);
  }

  .path {
    margin: 0;
    padding: 4px var(--space-2);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-control);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .version {
    margin: var(--space-4) 0 0;
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }
</style>
