import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TabStrip from "./TabStrip.svelte";

const lancelot = "character/lancelotxxxxxxxx";

describe("TabStrip", () => {
  const setup = () => {
    const onselect = vi.fn();
    const onclose = vi.fn();
    render(TabStrip, {
      tabs: ["graph", "dashboard", lancelot],
      active: "graph",
      label: (tab: string) =>
        tab === lancelot ? "Lancelot" : tab === "graph" ? "Graph" : "Dashboard",
      onselect,
      onclose,
    });
    return { onselect, onclose };
  };

  it("never offers to close the pinned tabs", () => {
    setup();
    expect(screen.getByRole("tab", { name: "Graph" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close Graph" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close Dashboard" })).toBeNull();
  });

  it("closes and selects other tabs", async () => {
    const { onselect, onclose } = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Close Lancelot" }));
    expect(onclose).toHaveBeenCalledWith(lancelot);
    await fireEvent.click(screen.getByRole("tab", { name: "Lancelot" }));
    expect(onselect).toHaveBeenCalledWith(lancelot);
  });

  it("marks the active tab", () => {
    setup();
    expect(screen.getByRole("tab", { name: "Graph" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Lancelot" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });
});
