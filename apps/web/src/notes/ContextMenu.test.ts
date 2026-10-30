import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ContextMenu from "./ContextMenu.svelte";
import { contextGroups } from "./actions.ts";

function mount(hasSelection = true, disabled: string[] = []) {
  const onchoose = vi.fn();
  const onclose = vi.fn();
  const view = render(ContextMenu, {
    x: 100,
    y: 100,
    groups: contextGroups(hasSelection),
    disabled: new Set(disabled),
    onchoose,
    onclose,
  });
  return { ...view, onchoose, onclose };
}

const search = () => screen.getByRole("textbox", { name: "Search actions…" });

describe("ContextMenu", () => {
  it("separates the groups with dividers, and starts in the search field", () => {
    mount(true);
    expect(screen.getAllByRole("separator")).toHaveLength(3);
    expect(document.activeElement).toBe(search());
  });

  it("has no formatting group without a selection", () => {
    mount(false);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.queryByRole("menuitem", { name: "Bold" })).toBeNull();
  });

  it("lists the actions in order", () => {
    mount(true);
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual([
      "Turn into",
      "Bold",
      "Italic",
      "Strikethrough",
      "Code",
      "Link…",
      "Cut",
      "Copy",
      "Paste",
      "Delete block",
    ]);
  });

  it("chooses an action by clicking it", async () => {
    const { onchoose } = mount(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Italic" }));
    expect(onchoose).toHaveBeenCalledExactlyOnceWith("italic");
  });

  it("opens the Turn into submenu and chooses a block from it", async () => {
    const { onchoose } = mount(true);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Turn into" }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Heading 2" }));
    expect(onchoose).toHaveBeenCalledExactlyOnceWith("turn:h2");
  });

  it("flattens everything into one list when searching", async () => {
    mount(true);
    await fireEvent.input(search(), { target: { value: "head" } });
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual([
      "Heading 1",
      "Heading 2",
      "Heading 3",
    ]);
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  it("chooses the first match on Enter", async () => {
    const { onchoose } = mount(true);
    await fireEvent.input(search(), { target: { value: "bold" } });
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(onchoose).toHaveBeenCalledExactlyOnceWith("bold");
  });

  it("moves with the arrow keys", async () => {
    const { onchoose } = mount(true);
    await fireEvent.keyDown(search(), { key: "ArrowDown" });
    await fireEvent.keyDown(search(), { key: "ArrowDown" });
    await fireEvent.keyDown(search(), { key: "Enter" });
    expect(onchoose).toHaveBeenCalledExactlyOnceWith("bold");
  });

  it("says when nothing matches", async () => {
    mount(true);
    await fireEvent.input(search(), { target: { value: "zzz" } });
    expect(screen.getByText("No matching actions")).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const { onclose } = mount(true);
    await fireEvent.keyDown(search(), { key: "Escape" });
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("won't choose an action that is disabled", async () => {
    const { onchoose } = mount(true, ["cut", "copy"]);
    const cut = screen.getByRole("menuitem", { name: "Cut" });
    expect(cut.getAttribute("aria-disabled")).toBe("true");
    await fireEvent.click(cut);
    expect(onchoose).not.toHaveBeenCalled();
  });
});
