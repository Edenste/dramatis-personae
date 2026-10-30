import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { Settings, Status } from "@dramatis-personae/schema";
import { createWebApi } from "../lib/api.ts";
import { fakeFetch } from "../test-utils/fakes.ts";
import SettingsDialog from "./SettingsDialog.svelte";

const settings: Settings = {
  dataRoot: "C:\\Users\\a\\AppData\\Local\\DramatisPersonae Data",
  defaultDataRoot: "C:\\Users\\a\\AppData\\Local\\DramatisPersonae Data",
  dataPath: null,
  theme: "system",
};

function setup(desktop: Status["desktop"]) {
  const server = fakeFetch({
    "PUT /api/settings": (body) => ({
      body: {
        settings: { ...settings, ...(body as object) },
        restartRequired: (body as { dataPath?: string }).dataPath !== undefined,
      },
    }),
    "POST /api/data-folder/choose": { body: { path: "C:\\Worlds" } },
    "POST /api/data-folder/open": { status: 204 },
    "POST /api/restart": { status: 202 },
  });
  const onclose = vi.fn();
  const ontheme = vi.fn();
  render(SettingsDialog, {
    api: createWebApi({ baseUrl: location.origin, fetch: server.fetch }),
    settings,
    desktop,
    version: "1.2.3",
    onclose,
    ontheme,
  });
  return { server, onclose, ontheme };
}

describe("SettingsDialog", () => {
  it("changes the theme at once and saves it", async () => {
    const { server } = setup(null);
    await fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await vi.waitFor(() =>
      expect(server.requests).toContainEqual(
        expect.objectContaining({ method: "PUT", body: { theme: "dark" } }),
      ),
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("picks a new data folder with the desktop app's folder picker, then offers a restart", async () => {
    const { server } = setup({ windowControls: "right" });
    expect(screen.getByText(settings.dataRoot)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Change…" }));
    expect(await screen.findByText("Restart to use the new folder.")).toBeTruthy();
    expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /api/data-folder/choose",
      "PUT /api/settings",
    ]);
    expect(server.requests[1]!.body).toEqual({ dataPath: "C:\\Worlds" });
    await fireEvent.click(screen.getByRole("button", { name: "Restart now" }));
    await vi.waitFor(() => expect(server.requests.at(-1)?.path).toBe("/api/restart"));
  });

  it("takes a typed path in a browser, and says to restart the server", async () => {
    const { server } = setup(null);
    await fireEvent.click(screen.getByRole("button", { name: "Change…" }));
    await fireEvent.input(screen.getByLabelText("New data folder"), {
      target: { value: "/home/a/worlds" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Restart the server to use the new folder.")).toBeTruthy();
    expect(server.requests.at(-1)?.body).toEqual({ dataPath: "/home/a/worlds" });
    expect(screen.queryByRole("button", { name: "Restart now" })).toBeNull();
  });

  it("tells the app which theme was chosen, so reopening shows it", async () => {
    const { ontheme } = setup(null);
    await fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(ontheme).toHaveBeenCalledWith("dark");
  });

  it("opens the data folder and shows the version", async () => {
    const { server } = setup(null);
    expect(screen.getByText("Version 1.2.3")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Open data folder" }));
    await vi.waitFor(() => expect(server.requests.at(-1)?.path).toBe("/api/data-folder/open"));
  });

  it("closes with Escape", async () => {
    const { onclose } = setup(null);
    await fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onclose).toHaveBeenCalled();
  });
});
