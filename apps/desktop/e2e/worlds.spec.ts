import { expect, test } from "./fixtures.ts";

const undoKey = process.platform === "darwin" ? "Meta+z" : "Control+z";

test.describe("worlds", () => {
  test("creates a world and switches between worlds", async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole("button", { name: "Camelot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arthur" })).toBeVisible();

    await page.getByRole("button", { name: "Camelot" }).click();
    await page.getByRole("menuitem", { name: "New world…" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Logres");
    await page.getByRole("button", { name: "Create world" }).click();
    await expect(page.getByRole("button", { name: "Logres" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arthur" })).toHaveCount(0);

    await page.getByRole("button", { name: "Logres" }).click();
    await page.getByRole("menuitemradio", { name: /Camelot/ }).click();
    await expect(page.getByRole("button", { name: "Camelot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Arthur" })).toBeVisible();
  });

  test("renames the world, then undoes and redoes it with the buttons and the keys", async ({
    app,
  }) => {
    const { page } = app;
    await page.getByRole("button", { name: "Camelot" }).click();
    await page.getByRole("menuitem", { name: "Rename Camelot…" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Camelot Reborn");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("button", { name: "Camelot Reborn" })).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Camelot", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(page.getByRole("button", { name: "Camelot Reborn" })).toBeVisible();

    await page.keyboard.press(undoKey);
    await expect(page.getByRole("button", { name: "Camelot", exact: true })).toBeVisible();
  });
});
