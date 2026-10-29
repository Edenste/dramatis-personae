import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { createWebApi } from "../lib/api.ts";
import { fakeFetch } from "../test-utils/fakes.ts";
import DataRootProblem from "./DataRootProblem.svelte";

describe("DataRootProblem", () => {
  it("names the folder and the problem, and lets you type another in a browser", async () => {
    const onsettings = vi.fn();
    render(DataRootProblem, {
      api: createWebApi({ baseUrl: location.origin, fetch: fakeFetch().fetch }),
      status: {
        version: "1.0.0",
        dataRoot: "D:\\Worlds",
        writable: false,
        problem: "D:\\Worlds is read-only, so changes couldn't be saved.",
        desktop: null,
      },
      onsettings,
    });
    expect(screen.getByRole("heading", { name: "Can't use the data folder" })).toBeTruthy();
    expect(screen.getByText(/D:\\Worlds is read-only/)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Choose another folder…" }));
    expect(screen.getByLabelText("New data folder")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onsettings).toHaveBeenCalled();
  });
});
