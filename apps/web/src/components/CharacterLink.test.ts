import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CharacterLink from "./CharacterLink.svelte";
import Portrait from "./Portrait.svelte";

const arthur = { id: "arthurxxxxxxxxxx", name: "Arthur", color: "#3b6fd4" };

describe("CharacterLink", () => {
  it("opens the character when clicked", async () => {
    const onopen = vi.fn();
    render(CharacterLink, { character: arthur, label: "Arthur", onopen });
    await fireEvent.click(screen.getByRole("link", { name: "Open Arthur" }));
    expect(onopen).toHaveBeenCalledExactlyOnceWith(arthur.id);
  });

  it("shows the character's current name, not the stored label", () => {
    render(CharacterLink, { character: arthur, label: "King Arthur", onopen: vi.fn() });
    expect(screen.getByRole("link").textContent).toContain("Arthur");
    expect(screen.getByRole("link").textContent).not.toContain("King");
  });

  it("shows a deleted character's label struck through, with no link", () => {
    render(CharacterLink, { character: null, label: "Arthur", onopen: vi.fn() });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Arthur").closest("s")).not.toBeNull();
  });
});

describe("Portrait", () => {
  it("shows the thumbnail", () => {
    const { container } = render(Portrait, { color: "#3b6fd4", size: 44, src: "/t.webp" });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/t.webp");
  });

  it("falls back to the silhouette when the image fails or there is none", async () => {
    const { container } = render(Portrait, { color: "#3b6fd4", size: 44, src: "/missing.webp" });
    await fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
