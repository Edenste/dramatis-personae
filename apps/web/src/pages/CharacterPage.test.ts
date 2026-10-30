import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { IDS, snapshot } from "../test-utils/fixtures.ts";
import { fromSnapshot } from "../lib/world-mirror.ts";
import CharacterPage from "./CharacterPage.svelte";

const state = fromSnapshot(snapshot());

describe("CharacterPage", () => {
  it("shows the character's name and says profiles come later", () => {
    render(CharacterPage, { state, id: IDS.lancelot });
    expect(screen.getByRole("heading", { name: "Lancelot" })).toBeTruthy();
    expect(screen.getByText("Profiles arrive in a later version.")).toBeTruthy();
  });

  it("says when the character was deleted", () => {
    render(CharacterPage, { state, id: "goneworldxxxxxxx" });
    expect(screen.getByText("This character was deleted.")).toBeTruthy();
  });
});
