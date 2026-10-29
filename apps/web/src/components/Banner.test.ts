import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Banner from "./Banner.svelte";

describe("Banner", () => {
  it("offers Retry and Discard for an unsaved change", async () => {
    const onretry = vi.fn();
    const ondiscard = vi.fn();
    render(Banner, {
      unsaved: { message: "Couldn't save your change. It's kept in the app." },
      readOnly: false,
      onretry,
      ondiscard,
    });
    expect(screen.getByText("Couldn't save your change. It's kept in the app.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onretry).toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(ondiscard).toHaveBeenCalled();
  });

  it("explains a read-only world", () => {
    render(Banner, { unsaved: null, readOnly: true, onretry: vi.fn(), ondiscard: vi.fn() });
    expect(
      screen.getByText(
        "This world was made by a newer version of Dramatis Personae, so it's open read-only.",
      ),
    ).toBeTruthy();
  });

  it("shows nothing otherwise", () => {
    const { container } = render(Banner, {
      unsaved: null,
      readOnly: false,
      onretry: vi.fn(),
      ondiscard: vi.fn(),
    });
    expect(container.textContent?.trim()).toBe("");
  });
});
