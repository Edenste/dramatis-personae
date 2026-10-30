import type { Page } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./fixtures.ts";

const card = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens a character's full page from the Graph: open its card, then expand it into a tab. */
async function openProfile(page: Page, name: string) {
  await page.getByRole("tab", { name: "Graph" }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: `Open ${name} as a tab` }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

/** A photo to upload: a gradient with a bright figure, 600 × 400. */
const photo = () =>
  sharp({ create: { width: 600, height: 400, channels: 3, background: "#3b6fd4" } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="300" height="400"><circle cx="150" cy="140" r="70" fill="#fff"/><rect x="60" y="230" width="180" height="170" fill="#fff"/></svg>',
        ),
        left: 150,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

test.describe("profiles", () => {
  test("keeps a field value and notes typed in edit mode across a relaunch", async ({ app }) => {
    const { page } = app;
    await openProfile(page, "Lancelot");
    await page.getByRole("button", { name: "Edit", exact: true }).click();

    const weapon = page.getByRole("textbox", { name: "Weapon" });
    await weapon.fill("Arondight II");
    await weapon.press("Enter");

    const notes = page.getByRole("textbox", { name: "Notes" });
    await notes.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n# Hello");
    await page.keyboard.press("Enter");
    await page.keyboard.type("polish the sword");
    await pause(1200); // the notes save 800 ms after typing stops
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.locator(".cm-dp-h1")).toHaveText("Hello");
    await app.relaunch();
    await expect(app.page.getByText("Arondight II")).toBeVisible();
    await expect(app.page.locator(".cm-dp-h1")).toHaveText("Hello");
  });

  test("shows an uploaded and cropped portrait on the page and on a card", async ({ app }) => {
    const { page } = app;
    await openProfile(page, "Lancelot");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "knight.png",
      mimeType: "image/png",
      buffer: await photo(),
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const thumbnail = page.locator("article .portrait img").first();
    await expect(thumbnail).toHaveAttribute("src", /\.thumb\.webp\?v=/);
    await expect
      .poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(256);

    await page.getByRole("tab", { name: "Graph" }).click();
    await page.getByRole("button", { name: "Lancelot", exact: true }).click();
    await expect(card(page, "Lancelot").locator(".portrait img")).toHaveAttribute(
      "src",
      /\.thumb\.webp\?v=/,
    );
  });

  test("makes a measurement field from a profile, and brings it back with undo after deleting it", async ({
    app,
  }) => {
    const { page } = app;
    await openProfile(page, "Lancelot");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Add a field" }).click();
    await page.getByRole("textbox", { name: "Search fields" }).fill("Shoe size");
    await page.getByRole("button", { name: 'Create "Shoe size"' }).click();
    await page.getByRole("combobox", { name: "Type" }).selectOption("measurement");
    await page.getByRole("textbox", { name: "Unit" }).fill("EU");
    await page.getByRole("button", { name: "Add field" }).click();

    const size = page.getByRole("textbox", { name: "Shoe size" });
    await size.fill("42");
    await size.press("Enter");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("42 EU")).toBeVisible();

    // Delete the field from the Fields and templates tab.
    await page.getByRole("button", { name: "Camelot", exact: true }).click();
    await page.getByRole("menuitem", { name: "Fields and templates" }).click();
    await page.getByRole("button", { name: "Shoe size", exact: true }).click();
    await page.getByRole("button", { name: "Delete field…" }).click();
    await expect(page.getByText("1 character will lose their value.")).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Shoe size", exact: true })).toBeHidden();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Shoe size", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Lancelot" }).click();
    await expect(page.getByText("42 EU")).toBeVisible();
  });

  test("keeps a template where it was dragged across a relaunch", async ({ app }) => {
    const { page } = app;
    await page.getByRole("button", { name: "Camelot", exact: true }).click();
    await page.getByRole("menuitem", { name: "Fields and templates" }).click();
    await page.getByRole("button", { name: "Add a template" }).click();

    const rows = () => page.locator("aside.sidebar section").nth(1).locator(".row");
    await expect(rows()).toHaveText(["Knight", "New template"]);

    const grip = (await page.getByRole("button", { name: "Move New template" }).boundingBox())!;
    const knight = (await page.getByRole("button", { name: "Knight", exact: true }).boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, knight.y - 4, { steps: 8 });
    await page.mouse.up();
    await expect(rows()).toHaveText(["New template", "Knight"]);

    await app.relaunch();
    await expect(app.page.locator("aside.sidebar section").nth(1).locator(".row")).toHaveText([
      "New template",
      "Knight",
    ]);
  });

  test("shows an edit made on the page in the same character's card", async ({ app }) => {
    const { page } = app;
    await openProfile(page, "Lancelot");
    await page.getByRole("tab", { name: "Graph" }).click();
    await page.getByRole("button", { name: "Lancelot", exact: true }).click();
    await expect(card(page, "Lancelot")).toBeVisible();

    await page.getByRole("tab", { name: "Lancelot" }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Notes" });
    await notes.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Seen from the card.");
    await pause(1200);

    await page.getByRole("tab", { name: "Graph" }).click();
    await expect(card(page, "Lancelot").locator(".cm-content")).toContainText(
      "Seen from the card.",
    );
  });
});
