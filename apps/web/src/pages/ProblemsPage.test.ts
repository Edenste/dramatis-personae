import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { Problem } from "@dramatis-personae/schema";
import ProblemsPage from "./ProblemsPage.svelte";

const kay = { kind: "character", id: "kayxxxxxxxxxxxxx" } as const;
const dangling: Problem = {
  code: "dangling-reference",
  path: "characters/kay-kayxxxxxxxxxxxxx.json",
  message: "Kay has a role that doesn't exist.",
  ref: kay,
  fix: "removeReference",
};
const broken: Problem = {
  code: "invalid-json",
  path: "characters/gawain-gawainxxxxxxxxxx.json",
  message: "This file isn't valid JSON: missing comma.",
  line: 14,
};
const copy: Problem = {
  code: "duplicate-id",
  path: "characters/kay-copy.json",
  message: "Another file already uses this ID.",
  fix: "assignNewId",
};

describe("ProblemsPage", () => {
  it("lists each problem with its file and a fix where there is one", async () => {
    const onfix = vi.fn();
    render(ProblemsPage, { worldName: "Camelot", problems: [dangling, broken], onfix });
    expect(screen.getByRole("heading", { name: "2 problems in Camelot" })).toBeTruthy();
    expect(
      screen.getByText(
        "Files with problems are left as they are until fixed. The app won't overwrite them.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(dangling.path)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Remove the reference" }));
    expect(onfix).toHaveBeenCalledWith({ fix: "removeReference", ref: kay });
    expect(screen.getByText(/, line 14/)).toBeTruthy();
    expect(screen.getByText("Fix in the file")).toBeTruthy();
  });

  it("offers a new ID for a copied file, and says 1 problem", async () => {
    const onfix = vi.fn();
    render(ProblemsPage, { worldName: "Camelot", problems: [copy], onfix });
    expect(screen.getByRole("heading", { name: "1 problem in Camelot" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Give the copy a new ID" }));
    expect(onfix).toHaveBeenCalledWith({ fix: "assignNewId", path: copy.path });
  });

  it("says when there are none", () => {
    render(ProblemsPage, { worldName: "Camelot", problems: [], onfix: vi.fn() });
    expect(screen.getByText("No problems in Camelot.")).toBeTruthy();
  });
});
