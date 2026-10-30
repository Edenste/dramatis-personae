import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { IDS, snapshot } from "../test-utils/fixtures.ts";
import { fromSnapshot } from "../lib/world-mirror.ts";
import DashboardPage from "./DashboardPage.svelte";

const state = fromSnapshot(snapshot());

describe("DashboardPage", () => {
  it("lists recently opened characters that still exist, and opens one", async () => {
    const onopen = vi.fn();
    render(DashboardPage, { state, recent: [IDS.merlin, "goneworldxxxxxxx"], onopen });
    expect(screen.getAllByRole("button", { name: /Merlin|goneworld/ })).toHaveLength(1);
    await fireEvent.click(screen.getByRole("button", { name: "Merlin" }));
    expect(onopen).toHaveBeenCalledWith(IDS.merlin);
  });

  it("shows empty states for dates and recent characters", () => {
    render(DashboardPage, { state, recent: [], onopen: vi.fn() });
    expect(screen.getByText("Birthdays and events will count down here.")).toBeTruthy();
    expect(screen.getByText("Characters you open will appear here.")).toBeTruthy();
  });
});
