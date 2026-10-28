import { describe, expect, it } from "vitest";
import { SerialQueue } from "./serial-queue.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SerialQueue", () => {
  it("runs tasks one at a time, in the order they were queued", async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    const task = (name: string, ms: number) => () =>
      (async () => {
        order.push(`start ${name}`);
        await delay(ms);
        order.push(`end ${name}`);
        return name;
      })();
    const results = await Promise.all([
      queue.run(task("a", 30)),
      queue.run(task("b", 10)),
      queue.run(task("c", 0)),
    ]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(order).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("keeps going after a task fails", async () => {
    const queue = new SerialQueue();
    const failed = queue.run(() => Promise.reject(new Error("boom")));
    const next = queue.run(() => Promise.resolve("next"));
    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("next");
  });
});
