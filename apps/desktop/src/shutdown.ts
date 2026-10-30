/** The parts of a BrowserWindow that shutDown uses. */
export interface ClosableWindow {
  isDestroyed(): boolean;
  once(event: "closed", callback: () => void): void;
  close(): void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Quits in the order that keeps the last change: the windows close first, so
 * each page saves its tabs and cards while the server is still running; a
 * moment later, once those saves have arrived, the server stops.
 */
export async function shutDown(input: {
  windows: ClosableWindow[];
  closeServer: () => Promise<void>;
  /** How long to wait for a window to close before moving on. */
  windowTimeoutMs?: number;
  /** How long after the windows close for their last save to reach the server. */
  graceMs?: number;
}): Promise<void> {
  const { windowTimeoutMs = 2000, graceMs = 200 } = input;
  await Promise.all(
    input.windows
      .filter((window) => !window.isDestroyed())
      .map(
        (window) =>
          new Promise<void>((resolve) => {
            window.once("closed", resolve);
            window.close();
            setTimeout(resolve, windowTimeoutMs);
          }),
      ),
  );
  await sleep(graceMs);
  await input.closeServer();
}
