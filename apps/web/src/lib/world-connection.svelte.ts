import {
  ServerMessageSchema,
  type CommandBatch,
  type CommandResult,
  type FixRequest,
  type ServerMessage,
} from "@dramatis-personae/schema";
import { ApiFailure, unwrap, type Api } from "./api.ts";
import { toBatch, type UndoHistory } from "./undo.ts";
import { applyMessage, fromSnapshot, type WorldState } from "./world-mirror.ts";

/** The parts of a WebSocket the connection uses, so tests can drive one. */
export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  close(): void;
}

const WORLD_UNAVAILABLE = 4004;
const FIRST_RETRY = 500;
const LONGEST_RETRY = 5000;
/** A connection that lasts this long starts the backoff again. */
const STABLE_AFTER = 10_000;

const UNDO_REFUSED = "Can't undo: it was changed outside the app since.";
const REDO_REFUSED = "Can't redo: it was changed outside the app since.";

function defaultSocket(url: string): WebSocketLike {
  const socket = new WebSocket(url);
  const like: WebSocketLike = {
    onopen: null,
    onmessage: null,
    onclose: null,
    close: () => socket.close(),
  };
  socket.onopen = () => like.onopen?.();
  socket.onmessage = (event) => like.onmessage?.({ data: String(event.data) });
  socket.onclose = (event) => like.onclose?.({ code: event.code, reason: event.reason });
  return like;
}

/**
 * One open world: a snapshot kept current by the world's WebSocket, the
 * commands that edit it, and its undo history (spec §10).
 */
export class WorldConnection {
  state = $state.raw<WorldState | null>(null);
  status = $state<"loading" | "ready" | "unavailable">("loading");
  unavailableReason = $state<string | null>(null);
  canUndo = $state(false);
  canRedo = $state(false);

  private socket: WebSocketLike | null = null;
  private buffered: ServerMessage[] = [];
  private loading = true;
  private closed = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stableTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly worldId: string,
    private readonly deps: {
      api: Api;
      history: UndoHistory;
      toast: (message: string) => void;
      socket?: (url: string) => WebSocketLike;
    },
  ) {
    this.syncHistory();
  }

  /** Connects the socket, then loads the snapshot, so no change falls between them. */
  open(): Promise<void> {
    return new Promise((resolve) => this.connect(resolve));
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.stableTimer);
    this.socket?.close();
  }

  async run(batch: CommandBatch): Promise<CommandResult | null> {
    if (this.refuseWhileUnsaved()) return null;
    const result = await this.post(() =>
      this.deps.api.POST("/api/worlds/{w}/commands", {
        params: { path: { w: this.worldId } },
        body: batch,
      }),
    );
    if (result) this.deps.history.recordEdit(result);
    this.syncHistory();
    return result;
  }

  async undo(): Promise<void> {
    await this.replay("undo");
  }

  async redo(): Promise<void> {
    await this.replay("redo");
  }

  async fix(request: FixRequest): Promise<void> {
    const result = await this.post(() =>
      this.deps.api.POST("/api/worlds/{w}/fixes", {
        params: { path: { w: this.worldId } },
        body: request,
      }),
    );
    if (result && result.inverse.commands.length > 0) this.deps.history.recordEdit(result);
    this.syncHistory();
  }

  async retry(): Promise<void> {
    const result = await this.post(() =>
      this.deps.api.POST("/api/worlds/{w}/retry", { params: { path: { w: this.worldId } } }),
    );
    if (result) this.deps.history.recordEdit(result);
    this.syncHistory();
  }

  async discardUnsaved(): Promise<void> {
    try {
      unwrap(
        await this.deps.api.POST("/api/worlds/{w}/discard-unsaved", {
          params: { path: { w: this.worldId } },
        }),
      );
      await this.loadSnapshot();
    } catch (error) {
      this.report(error);
    }
  }

  private async replay(direction: "undo" | "redo"): Promise<void> {
    if (this.refuseWhileUnsaved()) return;
    const { history } = this.deps;
    const entry = direction === "undo" ? history.takeUndo() : history.takeRedo();
    if (!entry) return;
    try {
      const result = unwrap(
        await this.deps.api.POST("/api/worlds/{w}/commands", {
          params: { path: { w: this.worldId } },
          body: toBatch(entry),
        }),
      );
      if (direction === "undo") history.recordUndone(result);
      else history.recordRedone(result);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "conflict") {
        this.deps.toast(direction === "undo" ? UNDO_REFUSED : REDO_REFUSED);
      } else {
        this.report(error);
      }
    }
    this.syncHistory();
  }

  private async post(
    request: () => Promise<{ data?: CommandResult; error?: unknown; response: Response }>,
  ): Promise<CommandResult | null> {
    try {
      return unwrap(await request());
    } catch (error) {
      this.report(error);
      return null;
    }
  }

  private refuseWhileUnsaved(): boolean {
    const unsaved = this.state?.unsaved;
    if (unsaved) this.deps.toast(unsaved.message);
    return unsaved != null;
  }

  private report(error: unknown): void {
    this.deps.toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
  }

  private syncHistory(): void {
    this.canUndo = this.deps.history.canUndo;
    this.canRedo = this.deps.history.canRedo;
  }

  private connect(onReady?: () => void): void {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = (this.deps.socket ?? defaultSocket)(
      `${protocol}://${location.host}/ws?world=${this.worldId}`,
    );
    this.socket = socket;
    this.loading = true;
    this.buffered = [];
    socket.onmessage = (event) => this.receive(event.data);
    socket.onopen = () => {
      this.stableTimer = setTimeout(() => (this.retries = 0), STABLE_AFTER);
      void this.loadSnapshot().finally(() => onReady?.());
    };
    socket.onclose = (event) => {
      clearTimeout(this.stableTimer);
      if (this.closed) return;
      if (event.code === WORLD_UNAVAILABLE) {
        this.markUnavailable(event.reason || "This world can't be opened.");
        onReady?.();
        return;
      }
      const delay = Math.min(FIRST_RETRY * 2 ** this.retries, LONGEST_RETRY);
      this.retries += 1;
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private async loadSnapshot(): Promise<void> {
    this.loading = true;
    try {
      const snapshot = unwrap(
        await this.deps.api.GET("/api/worlds/{w}", { params: { path: { w: this.worldId } } }),
      );
      let state = fromSnapshot(snapshot);
      for (const message of this.buffered) {
        const next = applyMessage(state, message);
        if (next !== "reload") state = next;
      }
      this.buffered = [];
      this.loading = false;
      this.state = state;
      this.status = "ready";
    } catch (error) {
      if (error instanceof ApiFailure && (error.status === 404 || error.status === 409)) {
        this.markUnavailable(error.message);
      } else {
        this.report(error);
      }
    }
  }

  private receive(data: string): void {
    const parsed = ServerMessageSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return;
    if (this.loading || !this.state) {
      this.buffered.push(parsed.data);
      return;
    }
    const next = applyMessage(this.state, parsed.data);
    if (next === "reload") void this.loadSnapshot();
    else this.state = next;
  }

  private markUnavailable(reason: string): void {
    this.status = "unavailable";
    this.unavailableReason = reason;
  }
}
