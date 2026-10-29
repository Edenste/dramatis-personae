type KeyInput = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "target">;

const editable = (target: EventTarget | null) =>
  target instanceof Element && target.closest("input, textarea, [contenteditable]") !== null;

/** Undo and redo keys; text fields keep their own undo. */
export function historyShortcut(
  event: KeyInput,
  platform: "mac" | "other",
): "undo" | "redo" | null {
  if (editable(event.target)) return null;
  const command =
    platform === "mac" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!command) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && platform === "other" && !event.shiftKey) return "redo";
  return null;
}
