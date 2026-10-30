import { describe, expect, it } from "vitest";
import { historyShortcut } from "./shortcuts.ts";

const key = (key: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) => ({
  key,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
  shiftKey: mods.shift ?? false,
  target: document.body,
});

describe("historyShortcut", () => {
  it("uses Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y outside the Mac", () => {
    expect(historyShortcut(key("z", { ctrl: true }), "other")).toBe("undo");
    expect(historyShortcut(key("Z", { ctrl: true, shift: true }), "other")).toBe("redo");
    expect(historyShortcut(key("y", { ctrl: true }), "other")).toBe("redo");
    expect(historyShortcut(key("z", { meta: true }), "other")).toBeNull();
  });

  it("uses ⌘Z and ⇧⌘Z on the Mac", () => {
    expect(historyShortcut(key("z", { meta: true }), "mac")).toBe("undo");
    expect(historyShortcut(key("z", { meta: true, shift: true }), "mac")).toBe("redo");
    expect(historyShortcut(key("z", { ctrl: true }), "mac")).toBeNull();
  });

  it("leaves text fields their own undo", () => {
    for (const tag of ["input", "textarea"]) {
      const field = document.createElement(tag);
      expect(historyShortcut({ ...key("z", { ctrl: true }), target: field }, "other")).toBeNull();
    }
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(historyShortcut({ ...key("z", { ctrl: true }), target: editable }, "other")).toBeNull();
  });

  it("leaves the notes editor its own undo, from any line inside it", () => {
    const content = document.createElement("div");
    content.setAttribute("contenteditable", "true");
    const line = document.createElement("div");
    content.append(line);
    expect(historyShortcut({ ...key("z", { ctrl: true }), target: line }, "other")).toBeNull();
    expect(historyShortcut({ ...key("y", { ctrl: true }), target: line }, "other")).toBeNull();
  });

  it("ignores other keys", () => {
    expect(historyShortcut(key("x", { ctrl: true }), "other")).toBeNull();
    expect(historyShortcut(key("z"), "other")).toBeNull();
  });
});
