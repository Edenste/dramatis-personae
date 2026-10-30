import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "./fixtures.ts";

const fileOf = async (dir: string, prefix: string) =>
  join(
    dir,
    (await readdir(dir)).find((name) => name.startsWith(prefix))!,
  );

test.describe("live updates", () => {
  test("shows a character created through the API", async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole("button", { name: "Arthur" })).toBeVisible();
    await app.api(`/api/worlds/${app.worldId}/commands`, {
      method: "POST",
      body: { commands: [{ type: "character.create", character: { name: "Dagonet" } }] },
    });
    await expect(page.getByRole("button", { name: "Dagonet" })).toBeVisible();
  });

  test("shows an edit made outside the app", async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole("button", { name: "Kay", exact: true })).toBeVisible();
    const file = await fileOf(join(app.worldDir, "characters"), "kay-");
    const kay = JSON.parse(await readFile(file, "utf8")) as { name: string };
    await writeFile(file, JSON.stringify({ ...kay, name: "Sir Kay" }, null, 2));
    await expect(page.getByRole("button", { name: "Sir Kay" })).toBeVisible();
  });

  test("lists a broken file under Problems", async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole("button", { name: "Gawain" })).toBeVisible();
    await writeFile(await fileOf(join(app.worldDir, "characters"), "gawain-"), "{ broken");
    await page.getByRole("button", { name: "1 problem" }).click();
    await expect(page.getByText("characters/gawain-")).toBeVisible();
    await expect(page.locator(".where")).toContainText(/line \d+/);
  });
});
