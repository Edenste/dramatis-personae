import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";

const card = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
const slot = (dialog: Locator) => dialog.locator("xpath=..");

/** A card's position, size and stacking order. */
async function geometry(dialog: Locator) {
  const box = (await dialog.boundingBox())!;
  const z = Number(await slot(dialog).evaluate((el) => (el as HTMLElement).style.zIndex));
  return { x: box.x, y: box.y, width: box.width, height: box.height, z };
}

async function dragStrip(page: Page, dialog: Locator, dx: number, dy: number) {
  const box = (await dialog.boundingBox())!;
  // The top edge: a card opened later overlaps the rest of this one's strip.
  const [x, y] = [box.x + 80, box.y + 8];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function openCards(page: Page, ...names: string[]) {
  await expect(page.getByRole("button", { name: names[0]!, exact: true })).toBeVisible();
  for (const name of names) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(card(page, name)).toBeVisible();
  }
}

async function breakGawain(worldDir: string) {
  const dir = join(worldDir, "characters");
  const file = (await readdir(dir)).find((name) => name.startsWith("gawain-"))!;
  await writeFile(join(dir, file), "{ broken");
}

test.describe("shell", () => {
  test("keeps open tabs, and the active one, across a relaunch", async ({ app }) => {
    await breakGawain(app.worldDir);
    await openCards(app.page, "Kay");
    await app.page.getByRole("button", { name: "Open Kay as a tab" }).click();
    await app.page.getByRole("button", { name: /^\d+ problems?$/ }).click();
    await expect(app.page.getByRole("tab", { name: "Problems" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await app.relaunch();
    await expect(app.page.getByRole("tab", { name: "Kay" })).toBeVisible();
    await expect(app.page.getByRole("tab", { name: "Problems" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("keeps cards where they were, in the same order and size, across a relaunch", async ({
    app,
  }) => {
    const { page } = app;
    await openCards(page, "Arthur", "Merlin");
    await dragStrip(page, card(page, "Arthur"), -400, 0);

    const corner = (await slot(card(page, "Merlin")).locator(".handle.se").boundingBox())!;
    await page.mouse.move(corner.x + 6, corner.y + 6);
    await page.mouse.down();
    await page.mouse.move(corner.x + 46, corner.y + 36, { steps: 6 });
    await page.mouse.up();

    await card(page, "Arthur").click({ position: { x: 20, y: 60 } });
    const before = {
      arthur: await geometry(card(page, "Arthur")),
      merlin: await geometry(card(page, "Merlin")),
    };
    expect(before.arthur.z).toBeGreaterThan(before.merlin.z);

    await app.relaunch();
    const after = {
      arthur: await geometry(card(app.page, "Arthur")),
      merlin: await geometry(card(app.page, "Merlin")),
    };
    for (const name of ["arthur", "merlin"] as const) {
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(after[name][key] - before[name][key])).toBeLessThanOrEqual(2);
      }
    }
    expect(after.arthur.z).toBeGreaterThan(after.merlin.z);

    await app.page.getByRole("tab", { name: "Dashboard" }).click();
    await expect(card(app.page, "Arthur")).toBeHidden();
    await expect(card(app.page, "Merlin")).toBeHidden();
  });

  test("saves a card moved just before quitting", async ({ app }) => {
    await openCards(app.page, "Kay");
    const before = await geometry(card(app.page, "Kay"));
    await dragStrip(app.page, card(app.page, "Kay"), -150, 90);
    const moved = await geometry(card(app.page, "Kay"));
    expect(Math.abs(moved.x - before.x)).toBeGreaterThan(50);

    await app.relaunch();
    const after = await geometry(card(app.page, "Kay"));
    expect(Math.abs(after.x - moved.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - moved.y)).toBeLessThanOrEqual(2);
  });

  test("changes the theme in Settings and keeps it after a relaunch", async ({ app }) => {
    await app.page.getByRole("button", { name: "Settings" }).click();
    await app.page.getByRole("radio", { name: "Dark" }).click();
    await expect(app.page.locator("html")).toHaveAttribute("data-theme", "dark");

    await app.relaunch();
    await expect(app.page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("opens cards without any scaling when reduced motion is asked for", async ({ app }) => {
    const { page } = app;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Kay", exact: true })).toBeVisible();
    const transform = await page.evaluate(async () => {
      const kay = [...document.querySelectorAll<HTMLElement>(".canvas button")].find(
        (b) => b.textContent?.trim() === "Kay",
      )!;
      kay.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return getComputedStyle(document.querySelector("[role=dialog]")!).transform;
    });
    expect(transform).toBe("none");
  });
});
