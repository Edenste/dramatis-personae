import type { CommandBatch, CommandResult, Crop } from "@dramatis-personae/schema";
import type { TabAddress } from "../lib/address.ts";
import type { QuietResult } from "../lib/world-connection.svelte.ts";

/**
 * What a profile can do to its world and the app. The page and the cards each
 * get their own, because a character link opens a card on the Graph and a tab
 * everywhere else (design spec §3.2).
 */
export interface ProfileActions {
  worldId: string;
  /** False for a viewer or a read-only world; edit controls then don't appear. */
  canEdit: boolean;
  run(batch: CommandBatch): Promise<CommandResult | null>;
  /** Like `run`, but a conflict comes back to the caller instead of a toast. For the notes. */
  runQuiet(batch: CommandBatch, options?: { keepalive?: boolean }): Promise<QuietResult>;
  /** Replaces the portrait; can't be undone. Resolves false after showing why it failed. */
  setPortrait(id: string, bytes: Uint8Array, crop: Crop): Promise<boolean>;
  /** Deletes the portrait; can't be undone. */
  removePortrait(id: string): Promise<boolean>;
  openCharacter(id: string): void;
  openTab(tab: TabAddress): void;
}
