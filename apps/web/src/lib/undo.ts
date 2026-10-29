import type { CommandBatch, CommandResult } from "@dramatis-personae/schema";

const LIMIT = 100;

/** An edit's inverse, and the fingerprints its files had right after the edit. */
export interface UndoEntry {
  inverse: CommandBatch;
  fingerprints: Record<string, string | null>;
}

const entryOf = (result: CommandResult): UndoEntry => ({
  inverse: result.inverse,
  fingerprints: result.fingerprints,
});

/**
 * One world's undo and redo stacks, held in the page and gone when it closes
 * (spec §10.3). Undoing sends the inverse with `expect`, so an undo is refused
 * if the files changed since.
 */
export class UndoHistory {
  private undos: UndoEntry[] = [];
  private redos: UndoEntry[] = [];

  get canUndo(): boolean {
    return this.undos.length > 0;
  }

  get canRedo(): boolean {
    return this.redos.length > 0;
  }

  recordEdit(result: CommandResult): void {
    this.push(this.undos, result);
    this.redos = [];
  }

  takeUndo(): UndoEntry | undefined {
    return this.undos.pop();
  }

  takeRedo(): UndoEntry | undefined {
    return this.redos.pop();
  }

  recordUndone(result: CommandResult): void {
    this.push(this.redos, result);
  }

  recordRedone(result: CommandResult): void {
    this.push(this.undos, result);
  }

  private push(stack: UndoEntry[], result: CommandResult): void {
    stack.push(entryOf(result));
    if (stack.length > LIMIT) stack.shift();
  }
}

export function toBatch(entry: UndoEntry): CommandBatch {
  return { commands: entry.inverse.commands, expect: entry.fingerprints };
}

const histories = new Map<string, UndoHistory>();

/** Each world's history, kept while the page is open, so switching worlds keeps it. */
export function historyFor(worldId: string): UndoHistory {
  let history = histories.get(worldId);
  if (!history) {
    history = new UndoHistory();
    histories.set(worldId, history);
  }
  return history;
}
