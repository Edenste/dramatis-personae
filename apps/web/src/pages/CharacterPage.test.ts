import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { fromSnapshot } from "../lib/world-mirror.ts";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot } from "../test-utils/fixtures.ts";
import CharacterPage from "./CharacterPage.svelte";

const state = fromSnapshot(profileSnapshot());

function mount(id: string, options: { canEdit?: boolean; state?: typeof state } = {}) {
  const fake = fakeActions({ canEdit: options.canEdit ?? true });
  render(CharacterPage, { state: options.state ?? state, id, actions: fake.actions });
  return fake;
}

describe("CharacterPage", () => {
  it("shows the profile in view mode", () => {
    mount(IDS.lancelot);
    expect(screen.getByRole("heading", { name: "Lancelot" })).toBeTruthy();
    expect(screen.getByText("Arondight")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("switches to edit mode and back with Edit and Done", async () => {
    mount(IDS.lancelot);
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("offers no Edit to someone who can't edit", () => {
    mount(IDS.lancelot, { canEdit: false });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("disables Edit and points to Problems while the character's file is broken", async () => {
    const path = state.files.get(`character:${IDS.lancelot}`)!.path;
    const broken = {
      ...state,
      problems: [{ code: "invalid-json" as const, path, message: "Unexpected token" }],
    };
    const { tabs } = mount(IDS.lancelot, { state: broken });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Edit" }).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "See Problems" }));
    expect(tabs).toEqual(["problems"]);
    expect(screen.getByText("This character's file has a problem.")).toBeTruthy();
  });

  it("leaves edit mode when the file breaks while editing", async () => {
    const fake = fakeActions();
    const view = render(CharacterPage, { state, id: IDS.lancelot, actions: fake.actions });
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const path = state.files.get(`character:${IDS.lancelot}`)!.path;
    await view.rerender({
      state: { ...state, problems: [{ code: "invalid-json" as const, path, message: "x" }] },
      id: IDS.lancelot,
      actions: fake.actions,
    });
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });

  it("says when the character was deleted", () => {
    mount("goneworldxxxxxxx");
    expect(screen.getByText("This character was deleted.")).toBeTruthy();
  });
});
