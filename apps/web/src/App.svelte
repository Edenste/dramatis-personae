<script lang="ts">
  import { Redo2, Undo2 } from "@lucide/svelte";
  import { onMount, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import type {
    FixRequest,
    Settings,
    Status,
    Theme,
    WorldSummary,
  } from "@dramatis-personae/schema";
  import Banner from "./components/Banner.svelte";
  import IconButton from "./components/IconButton.svelte";
  import NameDialog from "./components/NameDialog.svelte";
  import ProblemsBadge from "./components/ProblemsBadge.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import TabStrip from "./components/TabStrip.svelte";
  import TitleBar from "./components/TitleBar.svelte";
  import Toasts from "./components/Toasts.svelte";
  import WorldMenu from "./components/WorldMenu.svelte";
  import { locationFor, parseLocation, type TabAddress } from "./lib/address.ts";
  import { createWebApi, unwrap, type Api } from "./lib/api.ts";
  import { navigate, router } from "./lib/router.svelte.ts";
  import { historyShortcut } from "./lib/shortcuts.ts";
  import { applyTheme, resolveTheme } from "./lib/theme.ts";
  import { toasts } from "./lib/toasts.svelte.ts";
  import { historyFor } from "./lib/undo.ts";
  import { WorldConnection, type WebSocketLike } from "./lib/world-connection.svelte.ts";
  import { characterById, worldName } from "./lib/world-mirror.ts";
  import { WorkspaceState } from "./lib/workspace.svelte.ts";
  import DataRootProblem from "./pages/DataRootProblem.svelte";
  import FirstRun from "./pages/FirstRun.svelte";
  import ProblemsPage from "./pages/ProblemsPage.svelte";
  import WorldUnavailable from "./pages/WorldUnavailable.svelte";

  let { api = createWebApi(), socket }: { api?: Api; socket?: (url: string) => WebSocketLike } =
    $props();

  let phase = $state<"loading" | "data-root" | "first-run" | "world">("loading");
  let status = $state<Status | null>(null);
  let settings = $state<Settings | null>(null);
  let settingsOpen = $state(false);
  let theme = $state<Theme>("system");
  let worlds = $state<WorldSummary[]>([]);
  let connection = $state.raw<WorldConnection | null>(null);
  let workspace = $state.raw<WorkspaceState | null>(null);
  let dialog = $state<"new" | "rename" | null>(null);
  let booted = $state(false);
  let routing = 0;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const platform = navigator.platform.startsWith("Mac") ? "mac" : "other";
  const report = (error: unknown) =>
    toasts.show(error instanceof Error ? error.message : "Something went wrong. Try again.");

  const currentName = $derived(connection?.state ? worldName(connection.state) : "");

  function label(tab: TabAddress): string {
    if (tab === "graph") return "Graph";
    if (tab === "dashboard") return "Dashboard";
    if (tab === "problems") return "Problems";
    const id = tab.slice("character/".length);
    const state = connection?.state;
    return (state && characterById(state, id)?.name) ?? "Deleted character";
  }

  onMount(() => {
    const follow = () => applyTheme(resolveTheme(theme, prefersDark.matches));
    prefersDark.addEventListener("change", follow);
    void boot();
    return () => {
      prefersDark.removeEventListener("change", follow);
      connection?.close();
    };
  });

  async function boot(): Promise<void> {
    try {
      status = unwrap(await api.GET("/api/status"));
      settings = unwrap(await api.GET("/api/settings"));
      theme = settings.theme;
      applyTheme(resolveTheme(theme, prefersDark.matches));
      if (!status.writable) {
        phase = "data-root";
        return;
      }
      worlds = unwrap(await api.GET("/api/worlds"));
      booted = true;
    } catch (error) {
      report(error);
    }
  }

  // Only the path and boot should re-route: route() reads other state, which mustn't trigger it.
  $effect(() => {
    const path = router.path;
    if (booted) untrack(() => void route(path));
  });

  $effect(() => {
    document.title = currentName ? `${currentName} — Dramatis Personae` : "Dramatis Personae";
  });

  async function route(path: string): Promise<void> {
    const ticket = ++routing;
    try {
      const target = parseLocation(path);
      const available = worlds.filter((world) => world.problem === undefined);
      if (!target) {
        if (available.length === 0) {
          closeWorld();
          phase = "first-run";
          return;
        }
        const { lastWorld } = unwrap(await api.GET("/api/app-state"));
        const world = available.find((w) => w.id === lastWorld) ?? available[0]!;
        await openWorld(world.id);
        if (ticket === routing && workspace) {
          navigate(locationFor(world.id, workspace.active), { replace: true });
        }
        return;
      }
      if (!available.some((world) => world.id === target.world)) {
        navigate("/", { replace: true });
        return;
      }
      if (connection?.worldId !== target.world) await openWorld(target.world);
      if (ticket === routing) workspace?.open(target.tab);
    } catch (error) {
      report(error);
    }
  }

  async function openWorld(id: string): Promise<void> {
    if (connection?.worldId === id) return;
    closeWorld();
    const next = new WorldConnection(id, {
      api,
      history: historyFor(id),
      toast: (message) => toasts.show(message),
      ...(socket ? { socket } : {}),
    });
    const nextWorkspace = new WorkspaceState(id, { api });
    await Promise.all([next.open(), nextWorkspace.load()]);
    connection = next;
    workspace = nextWorkspace;
    phase = "world";
    void api.PUT("/api/app-state", { body: { lastWorld: id } }).catch(() => undefined);
  }

  function closeWorld(): void {
    workspace?.flush();
    connection?.close();
    connection = null;
    workspace = null;
  }

  /** World names can change (a rename, an outside edit), so the menu fetches them fresh. */
  async function refreshWorlds(): Promise<void> {
    try {
      worlds = unwrap(await api.GET("/api/worlds"));
    } catch (error) {
      report(error);
    }
  }

  async function switchWorld(id: string): Promise<void> {
    try {
      await openWorld(id);
      if (workspace) navigate(locationFor(id, workspace.active));
    } catch (error) {
      report(error);
    }
  }

  async function createWorld(name: string): Promise<void> {
    dialog = null;
    try {
      const world = unwrap(await api.POST("/api/worlds", { body: { name } }));
      worlds = [...worlds, world];
      navigate(locationFor(world.id, "graph"));
    } catch (error) {
      report(error);
    }
  }

  async function renameWorld(name: string): Promise<void> {
    dialog = null;
    await connection?.run({ commands: [{ type: "world.rename", name }] });
  }

  function selectTab(tab: TabAddress): void {
    if (connection) navigate(locationFor(connection.worldId, tab));
  }

  function closeTab(tab: TabAddress): void {
    if (!connection || !workspace) return;
    const next = workspace.close(tab);
    navigate(locationFor(connection.worldId, next), { replace: true });
  }

  async function openDataFolder(): Promise<void> {
    try {
      unwrap(await api.POST("/api/data-folder/open"));
    } catch (error) {
      report(error);
    }
  }

  function keydown(event: KeyboardEvent): void {
    const action = historyShortcut(event, platform);
    if (!action || !connection) return;
    event.preventDefault();
    void (action === "undo" ? connection.undo() : connection.redo());
  }
</script>

<svelte:window onkeydown={keydown} onpagehide={() => workspace?.flush()} />

<div class="app">
  <TitleBar
    windowControls={status?.desktop?.windowControls ?? null}
    onsettings={() => (settingsOpen = true)}
  >
    {#if phase === "world" && connection && workspace}
      <WorldMenu
        {worlds}
        currentId={connection.worldId}
        {currentName}
        readOnly={connection.state?.readOnly ?? false}
        onswitch={(id: string) => void switchWorld(id)}
        onnew={() => (dialog = "new")}
        onrename={() => (dialog = "rename")}
        onopen={() => void refreshWorlds()}
      />
      <TabStrip
        tabs={workspace.tabs}
        active={workspace.active}
        {label}
        onselect={selectTab}
        onclose={closeTab}
      />
    {/if}
    {#snippet actions()}
      {#if phase === "world" && connection}
        <IconButton
          label="Undo"
          disabled={!connection.canUndo}
          onclick={() => void connection?.undo()}
        >
          <Undo2 size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton
          label="Redo"
          disabled={!connection.canRedo}
          onclick={() => void connection?.redo()}
        >
          <Redo2 size={16} strokeWidth={1.5} />
        </IconButton>
        <ProblemsBadge
          count={connection.state?.problems.length ?? 0}
          onopen={() => selectTab("problems")}
        />
      {/if}
    {/snippet}
  </TitleBar>

  <main class="page">
    {#if phase === "first-run"}
      <FirstRun oncreate={(name: string) => void createWorld(name)} />
    {:else if phase === "data-root" && status}
      <DataRootProblem {api} {status} onsettings={() => (settingsOpen = true)} />
    {:else if phase === "world" && connection && workspace}
      {#if connection.status === "unavailable"}
        <WorldUnavailable
          reason={connection.unavailableReason ?? "This world can't be opened."}
          onopenfolder={() => void openDataFolder()}
        />
      {:else}
        <div class="world">
          <Banner
            unsaved={connection.state?.unsaved ?? null}
            readOnly={connection.state?.readOnly ?? false}
            onretry={() => void connection?.retry()}
            ondiscard={() => void connection?.discardUnsaved()}
          />
          <div class="tab-area">
            {#key workspace.active}
              <section class="tab-page" in:fade={{ duration: 120 }}>
                {#if workspace.active === "problems"}
                  <ProblemsPage
                    worldName={currentName}
                    problems={connection.state?.problems ?? []}
                    onfix={(request: FixRequest) => void connection?.fix(request)}
                  />
                {:else}
                  <p class="placeholder">{label(workspace.active)}</p>
                {/if}
              </section>
            {/key}
          </div>
        </div>
      {/if}
    {/if}
    <Toasts />
  </main>
</div>

{#if settingsOpen && settings}
  <SettingsDialog
    {api}
    {settings}
    desktop={status?.desktop ?? null}
    version={status?.version ?? ""}
    onclose={() => (settingsOpen = false)}
    ontheme={(next: Theme) => (theme = next)}
  />
{/if}

{#if dialog === "new"}
  <NameDialog
    mode="create"
    onsubmit={(name: string) => void createWorld(name)}
    onclose={() => (dialog = null)}
  />
{:else if dialog === "rename"}
  <NameDialog
    mode="rename"
    initial={currentName}
    onsubmit={(name: string) => void renameWorld(name)}
    onclose={() => (dialog = null)}
  />
{/if}

<style>
  .app {
    display: grid;
    grid-template-rows: var(--size-titlebar) 1fr;
    height: 100%;
  }

  .page {
    position: relative;
    margin: 0 var(--space-2) var(--space-2);
    overflow: hidden;
    border-radius: var(--radius-page);
    background: var(--color-page);
    box-shadow: 0 0 0 1px var(--color-hairline);
  }

  .world {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
  }

  .tab-area {
    position: relative;
    min-height: 0;
  }

  .tab-page {
    position: absolute;
    inset: 0;
    overflow: auto;
  }

  .placeholder {
    margin: var(--space-5);
    color: var(--color-text-secondary);
  }
</style>
