import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGraphView, type GraphNode } from "./index.ts";

const merlin: GraphNode = { id: "merlinxxxxxxxxxx", label: "Merlin", color: "#2bb673" };
const arthur: GraphNode = { id: "arthurxxxxxxxxxx", label: "Arthur", color: "#3b6fd4" };
const kay: GraphNode = { id: "kayxxxxxxxxxxxxx", label: "Kay", color: "#99aab5" };

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].map((b) => b.textContent?.trim());

describe("the placeholder graph view", () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
  });

  it("lists nodes by label, ringed in their colour", () => {
    createGraphView(container, { nodes: [merlin, arthur], edges: [] });
    expect(labels(container)).toEqual(["Arthur", "Merlin"]);
    const ring = container.querySelector("button span") as HTMLElement;
    expect(ring.style.borderColor).toBe("rgb(59, 111, 212)");
  });

  it("reports a click as a select event", () => {
    const view = createGraphView(container, { nodes: [merlin, arthur], edges: [] });
    const listener = vi.fn();
    view.on(listener);
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent?.includes("Merlin"))!
      .click();
    expect(listener).toHaveBeenCalledWith({ type: "select", id: merlin.id });
  });

  it("re-renders on update", () => {
    const view = createGraphView(container, { nodes: [merlin], edges: [] });
    view.update({ nodes: [merlin, arthur, kay], edges: [] });
    expect(labels(container)).toEqual(["Arthur", "Kay", "Merlin"]);
  });

  it("says so when there are no characters", () => {
    createGraphView(container, { nodes: [], edges: [] });
    expect(container.textContent).toContain("No characters yet.");
  });

  it("removes everything and stops reporting after destroy", () => {
    const view = createGraphView(container, { nodes: [merlin], edges: [] });
    const listener = vi.fn();
    view.on(listener);
    const button = container.querySelector("button")!;
    view.destroy();
    expect(container.childElementCount).toBe(0);
    button.click();
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops one listener when it unsubscribes", () => {
    const view = createGraphView(container, { nodes: [merlin], edges: [] });
    const kept = vi.fn();
    const dropped = vi.fn();
    view.on(kept);
    view.on(dropped)();
    container.querySelector("button")!.click();
    expect(kept).toHaveBeenCalledOnce();
    expect(dropped).not.toHaveBeenCalled();
  });
});
