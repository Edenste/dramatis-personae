import type { CardState, WorkspaceFile } from "@dramatis-personae/schema";
import { unwrap, type Api } from "./api.ts";
import { PINNED, isTabAddress, normaliseTabs, type TabAddress } from "./address.ts";

const RECENT_LIMIT = 20;
const CARDS_LIMIT = 50;
const SAVE_AFTER = 300;

/**
 * One world's interface state (spec §7): open tabs, the active tab, recent
 * characters and open cards. Saved to the server shortly after each change.
 */
export class WorkspaceState {
  tabs = $state<TabAddress[]>([...PINNED]);
  active = $state<TabAddress>("graph");
  recent = $state<string[]>([]);
  cards = $state<Record<string, CardState[]>>({});

  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly debounceMs: number;
  private readonly keepaliveFetch: typeof fetch;

  constructor(
    readonly worldId: string,
    private readonly deps: { api: Api; debounceMs?: number; keepaliveFetch?: typeof fetch },
  ) {
    this.debounceMs = deps.debounceMs ?? SAVE_AFTER;
    this.keepaliveFetch = deps.keepaliveFetch ?? ((...args) => fetch(...args));
  }

  async load(): Promise<void> {
    const file = unwrap(
      await this.deps.api.GET("/api/worlds/{w}/workspace", {
        params: { path: { w: this.worldId } },
      }),
    );
    this.tabs = normaliseTabs(file.tabs);
    const active = file.activeTab;
    this.active = active && isTabAddress(active) && this.tabs.includes(active) ? active : "graph";
    this.recent = file.recentCharacters;
    this.cards = file.cards;
  }

  open(tab: TabAddress): void {
    if (!this.tabs.includes(tab)) this.tabs = [...this.tabs, tab];
    this.active = tab;
    if (tab.startsWith("character/")) {
      const id = tab.slice("character/".length);
      this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
    }
    this.schedule();
  }

  /** Closes a tab and returns the tab to show instead; pinned tabs stay open. */
  close(tab: TabAddress): TabAddress {
    if (PINNED.includes(tab)) return this.active;
    const index = this.tabs.indexOf(tab);
    if (index < 0) return this.active;
    this.tabs = this.tabs.filter((t) => t !== tab);
    if (this.active === tab) this.active = this.tabs[index - 1] ?? "graph";
    this.schedule();
    return this.active;
  }

  setCards(tab: TabAddress, cards: CardState[]): void {
    this.cards = { ...this.cards, [tab]: cards.slice(-CARDS_LIMIT) };
    this.schedule();
  }

  /** Saves a pending change now, with a request that outlives the page. */
  flush(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    const url = `${location.origin}/api/worlds/${this.worldId}/workspace`;
    void this.keepaliveFetch(url, {
      method: "PUT",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.file()),
    }).catch(() => undefined);
  }

  private file(): WorkspaceFile {
    return {
      tabs: [...this.tabs],
      activeTab: this.active,
      recentCharacters: [...this.recent],
      cards: $state.snapshot(this.cards),
    };
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.deps.api
        .PUT("/api/worlds/{w}/workspace", {
          params: { path: { w: this.worldId } },
          body: this.file(),
        })
        .catch(() => undefined);
    }, this.debounceMs);
  }
}
