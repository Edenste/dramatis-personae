import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WorldMenu from "./WorldMenu.svelte";

const camelot = { id: "camelotxxxxxxxxx", name: "Camelot", folder: "camelot", schemaVersion: 1 };
const logres = { id: "logresxxxxxxxxxx", name: "Logres", folder: "logres", schemaVersion: 1 };
const avalon = {
  id: "avalonxxxxxxxxxx",
  name: "Avalon",
  folder: "avalon",
  schemaVersion: null,
  problem: "Made by a newer version",
};

describe("WorldMenu", () => {
  const open = async (readOnly = false) => {
    const handlers = { onswitch: vi.fn(), onnew: vi.fn(), onrename: vi.fn(), onopen: vi.fn() };
    render(WorldMenu, {
      worlds: [camelot, logres, avalon],
      currentId: camelot.id,
      currentName: "Camelot",
      readOnly,
      ...handlers,
    });
    await fireEvent.click(screen.getByRole("button", { name: /Camelot/ }));
    return handlers;
  };

  it("lists the worlds, ticking the open one", async () => {
    await open();
    expect(
      screen.getByRole("menuitemradio", { name: /Camelot/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: /Logres/ }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("greys out a world that can't open, with the reason", async () => {
    const { onswitch } = await open();
    const item = screen.getByRole("menuitemradio", { name: /Avalon/ });
    expect(item.hasAttribute("disabled")).toBe(true);
    expect(item.textContent).toContain("Made by a newer version");
    await fireEvent.click(item);
    expect(onswitch).not.toHaveBeenCalled();
  });

  it("switches worlds and offers New world and Rename", async () => {
    const { onswitch, onnew } = await open();
    await fireEvent.click(screen.getByRole("menuitemradio", { name: /Logres/ }));
    expect(onswitch).toHaveBeenCalledWith(logres.id);
    await fireEvent.click(screen.getByRole("button", { name: /Camelot/ }));
    expect(screen.getByRole("menuitem", { name: "Rename Camelot…" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("menuitem", { name: "New world…" }));
    expect(onnew).toHaveBeenCalled();
  });

  it("asks for a fresh list of worlds each time it opens", async () => {
    const { onopen } = await open();
    expect(onopen).toHaveBeenCalledOnce();
  });

  it("hides Rename for a read-only world", async () => {
    await open(true);
    expect(screen.queryByRole("menuitem", { name: "Rename Camelot…" })).toBeNull();
  });
});
