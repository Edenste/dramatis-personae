import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesAutosave, type SaveOutcome } from "./autosave.ts";

const DELAY = 800;

/** An autosave whose saves the test finishes by hand, so it can act while one is in flight. */
function setup(initial = { body: "start", fingerprint: "fp0" }) {
  const calls: Array<{ text: string; expect: string | null; finish: (o: SaveOutcome) => void }> =
    [];
  const save = vi.fn(
    (text: string, expectFingerprint: string | null) =>
      new Promise<SaveOutcome>((resolve) => {
        calls.push({ text, expect: expectFingerprint, finish: resolve });
      }),
  );
  const autosave = new NotesAutosave({ save }, initial);
  const onconflict = vi.fn();
  autosave.onconflict = onconflict;
  /** Lets the latest save succeed, as the server would, with this new fingerprint. */
  const succeed = async (fingerprint: string, call = calls.at(-1)!) => {
    call.finish({ ok: true, fingerprint });
    await vi.advanceTimersByTimeAsync(0);
  };
  return { autosave, save, calls, onconflict, succeed };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("when it saves", () => {
  it("waits 800 ms after the last change, then saves once with what was typed", async () => {
    const { autosave, save, calls } = setup();
    autosave.edit("a");
    await vi.advanceTimersByTimeAsync(300);
    autosave.edit("ab");
    await vi.advanceTimersByTimeAsync(300);
    autosave.edit("abc");
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
    expect(calls[0]).toMatchObject({ text: "abc", expect: "fp0" });
  });

  it("saves at once on flush, and does nothing when there is nothing to save", async () => {
    const { autosave, save } = setup();
    await autosave.flush();
    expect(save).not.toHaveBeenCalled();
    autosave.edit("changed");
    void autosave.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledOnce();
  });

  it("doesn't save when the text is typed back to what is saved", async () => {
    const { autosave, save } = setup();
    autosave.edit("start!");
    autosave.edit("start");
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.dirty).toBe(false);
  });

  it("sends the next save with the fingerprint the last one returned", async () => {
    const { autosave, calls, succeed } = setup();
    autosave.edit("one");
    await vi.advanceTimersByTimeAsync(DELAY);
    await succeed("fp1");
    autosave.edit("two");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(calls[1]).toMatchObject({ text: "two", expect: "fp1" });
  });

  it("never runs two saves at once: a change made during one waits for it", async () => {
    const { autosave, save, calls, succeed } = setup();
    autosave.edit("one");
    await vi.advanceTimersByTimeAsync(DELAY);
    autosave.edit("one and more");
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).toHaveBeenCalledOnce();
    await succeed("fp1", calls[0]);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]).toMatchObject({ text: "one and more", expect: "fp1" });
  });

  it("keeps what failed to save and tries again on the next flush", async () => {
    const { autosave, save, calls } = setup();
    autosave.edit("one");
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0]!.finish({ ok: false, conflict: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.dirty).toBe(true);
    void autosave.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]).toMatchObject({ text: "one", expect: "fp0" });
  });
});

// Review focus 1: the server's own echo of a save arriving while the person keeps typing.
describe("a save's own echo", () => {
  it("is not taken for an outside change, and the next save carries its fingerprint", async () => {
    const { autosave, calls, succeed } = setup();
    autosave.edit("A");
    await vi.advanceTimersByTimeAsync(DELAY); // A is in flight
    autosave.edit("B"); // typing continues
    expect(autosave.remote("A", "fpA")).toBe("keep");
    await succeed("fpA", calls[0]);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(calls[1]).toMatchObject({ text: "B", expect: "fpA" });
  });

  it("is kept when it arrives after the reply too", async () => {
    const { autosave, calls, succeed } = setup();
    autosave.edit("A");
    await vi.advanceTimersByTimeAsync(DELAY);
    await succeed("fpA", calls[0]);
    autosave.edit("B");
    expect(autosave.remote("A", "fpA")).toBe("keep");
  });
});

// Review focus 4: a body written outside with Windows line endings.
describe("line endings", () => {
  it("doesn't save a body just for having been opened, or for how its lines end", async () => {
    const { autosave, save } = setup({ body: "a\r\nb", fingerprint: "fp0" });
    autosave.edit("a\nb"); // what the editor reports for the same text
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("saves with \\n line endings once there is a real change", async () => {
    const { autosave, calls } = setup({ body: "a\r\nb", fingerprint: "fp0" });
    autosave.edit("a\nb!");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(calls[0]!.text).toBe("a\nb!");
  });

  it("sees an outside body that differs only in line endings as no change", () => {
    const { autosave } = setup({ body: "a\nb", fingerprint: "fp0" });
    expect(autosave.remote("a\r\nb", "fp1")).toBe("keep");
  });
});

// Review focus 5: the same character open in two places.
describe("changes from outside", () => {
  it("are applied when nothing is unsaved", () => {
    const { autosave } = setup();
    expect(autosave.remote("new text", "fp2")).toBe("apply");
    // and what is now saved is the new text: typing it back changes nothing
    autosave.edit("new text");
    expect(autosave.dirty).toBe(false);
  });

  it("wait while there is unsaved text, and the next save meets the conflict", async () => {
    const { autosave, calls, onconflict } = setup();
    autosave.edit("mine");
    expect(autosave.remote("theirs", "fp2")).toBe("keep");
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0]!.finish({ ok: false, conflict: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(onconflict).toHaveBeenCalledOnce();
  });

  it("send nothing more until a conflict is settled", async () => {
    const { autosave, save, calls } = setup();
    autosave.edit("mine");
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0]!.finish({ ok: false, conflict: true });
    await vi.advanceTimersByTimeAsync(0);
    autosave.edit("mine, more");
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).toHaveBeenCalledOnce();
  });

  it("keep mine resends without expecting a fingerprint", async () => {
    const { autosave, calls, succeed, onconflict } = setup();
    autosave.edit("mine");
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0]!.finish({ ok: false, conflict: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(onconflict).toHaveBeenCalled();
    void autosave.resolve("mine");
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[1]).toMatchObject({ text: "mine", expect: null });
    await succeed("fp3", calls[1]);
    expect(autosave.dirty).toBe(false);
  });

  it("take theirs drops what was typed and adopts the other version", async () => {
    const { autosave, calls } = setup();
    autosave.edit("mine");
    await vi.advanceTimersByTimeAsync(DELAY);
    calls[0]!.finish({ ok: false, conflict: true });
    await vi.advanceTimersByTimeAsync(0);
    await autosave.resolve("theirs", { body: "theirs", fingerprint: "fp2" });
    expect(autosave.dirty).toBe(false);
    autosave.edit("theirs and more");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(calls[1]).toMatchObject({ text: "theirs and more", expect: "fp2" });
  });
});
