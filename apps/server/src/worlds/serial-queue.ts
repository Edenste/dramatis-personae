/** Runs async tasks one at a time, in the order they were queued. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    // A failed task mustn't stop the ones queued after it.
    this.tail = result.catch(() => undefined);
    return result;
  }
}
