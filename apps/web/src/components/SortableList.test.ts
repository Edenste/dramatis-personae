import { createRawSnippet } from "svelte";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SortableList from "./SortableList.svelte";

interface Item {
  id: string;
  name: string;
}
const items: Item[] = [
  { id: "knight", name: "Knight" },
  { id: "squire", name: "Squire" },
  { id: "page", name: "Page" },
];

function mount(extra: Record<string, unknown> = {}) {
  const onmove = vi.fn();
  const onselect = vi.fn();
  const row = createRawSnippet((item: () => Item) => ({
    render: () => `<span>${item().name}</span>`,
  }));
  const view = render(SortableList<Item>, {
    items,
    key: (item: Item) => item.id,
    name: (item: Item) => item.name,
    selected: null,
    onmove,
    onselect,
    row,
    ...extra,
  });
  return { ...view, onmove, onselect };
}

afterEach(() => vi.restoreAllMocks());

describe("SortableList", () => {
  it("shows each row with a grip to move it", () => {
    mount();
    expect(
      screen.getAllByRole("button", { name: /^Move / }).map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Move Knight", "Move Squire", "Move Page"]);
  });

  it("selects a row when it is clicked", async () => {
    const { onselect } = mount();
    await fireEvent.click(screen.getByRole("button", { name: "Squire" }));
    expect(onselect).toHaveBeenCalledExactlyOnceWith("squire");
  });

  it("marks the selected row", () => {
    mount({ selected: "page" });
    expect(screen.getByRole("button", { name: "Page" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Knight" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  describe("from the keyboard", () => {
    it("moves a row down with the down arrow, and says so", async () => {
      const { onmove } = mount();
      await fireEvent.keyDown(screen.getByRole("button", { name: "Move Knight" }), {
        key: "ArrowDown",
      });
      expect(onmove).toHaveBeenCalledExactlyOnceWith("knight", 1);
      expect(screen.getByRole("status").textContent).toBe("Knight, moved to position 2 of 3");
    });

    it("moves a row up with the up arrow", async () => {
      const { onmove } = mount();
      await fireEvent.keyDown(screen.getByRole("button", { name: "Move Page" }), {
        key: "ArrowUp",
      });
      expect(onmove).toHaveBeenCalledExactlyOnceWith("page", 1);
    });

    it("stops at the ends", async () => {
      const { onmove } = mount();
      await fireEvent.keyDown(screen.getByRole("button", { name: "Move Knight" }), {
        key: "ArrowUp",
      });
      await fireEvent.keyDown(screen.getByRole("button", { name: "Move Page" }), {
        key: "ArrowDown",
      });
      expect(onmove).not.toHaveBeenCalled();
    });
  });

  describe("by dragging", () => {
    /** Rows 30 px tall, stacked from the top. */
    function layOut() {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        const index = Number(this.dataset.index ?? 0);
        return {
          top: index * 30,
          height: 30,
          bottom: index * 30 + 30,
          left: 0,
          right: 200,
          width: 200,
          x: 0,
          y: index * 30,
          toJSON: () => ({}),
        };
      });
    }

    it("moves a row to where it is dropped", async () => {
      layOut();
      const { onmove } = mount();
      await fireEvent.pointerDown(screen.getByRole("button", { name: "Move Knight" }), {
        clientY: 15,
        button: 0,
      });
      await fireEvent.pointerMove(window, { clientY: 75 });
      await fireEvent.pointerUp(window, { clientY: 75 });
      expect(onmove).toHaveBeenCalledExactlyOnceWith("knight", 1);
    });

    it("moves a row up", async () => {
      layOut();
      const { onmove } = mount();
      await fireEvent.pointerDown(screen.getByRole("button", { name: "Move Page" }), {
        clientY: 75,
        button: 0,
      });
      await fireEvent.pointerMove(window, { clientY: 5 });
      await fireEvent.pointerUp(window, { clientY: 5 });
      expect(onmove).toHaveBeenCalledExactlyOnceWith("page", 0);
    });

    it("does nothing when dropped where it started", async () => {
      layOut();
      const { onmove } = mount();
      await fireEvent.pointerDown(screen.getByRole("button", { name: "Move Squire" }), {
        clientY: 45,
        button: 0,
      });
      await fireEvent.pointerUp(window, { clientY: 46 });
      expect(onmove).not.toHaveBeenCalled();
    });
  });

  it("can't be reordered while disabled", async () => {
    const { onmove } = mount({ disabled: true });
    const grip = screen.getByRole<HTMLButtonElement>("button", { name: "Move Knight" });
    expect(grip.disabled).toBe(true);
    await fireEvent.keyDown(grip, { key: "ArrowDown" });
    expect(onmove).not.toHaveBeenCalled();
  });
});
