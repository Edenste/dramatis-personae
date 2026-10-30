import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyCamelot, type TempCamelot } from "@dramatis-personae/core/testing";
import { CAMELOT_IDS } from "@dramatis-personae/samples";
import type { CommandResult, WorldSnapshot } from "@dramatis-personae/schema";
import { AUTH, testPaths, testServer, type TestServer } from "../test-utils/server.ts";

const WAIT = { timeout: 3000, interval: 50 };
const lancelot = CAMELOT_IDS.characters.Lancelot!;
const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

/** A 400 × 200 image, red on the left half and blue on the right. */
async function halves(): Promise<Sharp> {
  const left = await sharp({ create: { width: 200, height: 200, channels: 3, background: RED } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 400, height: 200, channels: 3, background: BLUE } }).composite([
    { input: left, left: 0, top: 0 },
  ]);
}

describe("portrait routes", () => {
  let camelot: TempCamelot;
  let server: TestServer;
  let base: string;
  const portraits = () => join(camelot.worldPath, "assets", "portraits");

  async function start(overrides: Parameters<typeof testServer>[0] = {}) {
    server = await testServer({ temp: camelot, paths: testPaths(camelot), ...overrides });
  }
  const get = (url: string) => server.app.inject({ method: "GET", url, headers: AUTH });
  const upload = (
    query: string,
    payload: Uint8Array | Buffer,
    id = lancelot,
    method: "PUT" = "PUT",
  ) =>
    server.app.inject({
      method,
      url: `${base}/characters/${id}/portrait?${query}`,
      headers: { ...AUTH, "content-type": "application/octet-stream" },
      payload: Buffer.from(payload),
    });
  const remove = (id = lancelot) =>
    server.app.inject({
      method: "DELETE",
      url: `${base}/characters/${id}/portrait`,
      headers: AUTH,
    });
  const portraitOf = async (id = lancelot) => {
    const snapshot = (await get(base)).json<WorldSnapshot>();
    const file = snapshot.files.find((f) => f.ref.kind === "character" && f.ref.id === id);
    return (file?.data as { portrait?: { file: string; crop: object } }).portrait;
  };
  const assets = async () => (await readdir(portraits())).sort();

  beforeEach(async () => {
    camelot = await copyCamelot();
    base = `/api/worlds/${camelot.worldId}`;
  });
  afterEach(async () => {
    await server.close();
  });

  describe("uploading", () => {
    it("saves the image under the character's name and sets the portrait, with no undo", async () => {
      await start();
      const jpeg = await sharp({
        create: { width: 400, height: 300, channels: 3, background: RED },
      })
        .jpeg()
        .toBuffer();
      const response = await upload("x=0.1&y=0&size=1", jpeg);
      expect(response.statusCode).toBe(200);
      expect(response.json<CommandResult>().inverse).toEqual({ commands: [] });
      expect(await portraitOf()).toEqual({
        file: `lancelot-${lancelot}.jpg`,
        crop: { x: 0.1, y: 0, size: 1 },
      });
      expect(await assets()).toContain(`lancelot-${lancelot}.jpg`);
    });

    it("replaces the file when the new image is another format, and drops the old thumbnail", async () => {
      await start();
      const solid = sharp({ create: { width: 300, height: 300, channels: 3, background: RED } });
      await upload("x=0&y=0&size=1", await solid.clone().jpeg().toBuffer());
      expect(
        (await get(`${base}/assets/portraits/lancelot-${lancelot}.jpg.thumb.webp`)).statusCode,
      ).toBe(200);
      await upload("x=0&y=0&size=1", await solid.clone().png().toBuffer());
      const names = await assets();
      expect(names).toContain(`lancelot-${lancelot}.png`);
      expect(names).not.toContain(`lancelot-${lancelot}.jpg`);
      expect(names).not.toContain(`lancelot-${lancelot}.jpg.thumb.webp`);
    });

    it.each([
      ["an SVG", () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      ["text renamed to look like a PNG", () => Buffer.from("this is not a png")],
    ])("refuses %s and changes nothing", async (_label, make) => {
      await start();
      const before = await assets();
      const response = await upload("x=0&y=0&size=1", make());
      expect(response.statusCode).toBe(415);
      expect(response.json()).toMatchObject({
        code: "unsupported-image",
        message: "That file isn't a supported image. Use JPG, PNG, WebP, GIF or AVIF.",
      });
      expect(await portraitOf()).toBeUndefined();
      expect(await assets()).toEqual(before);
    });

    it("refuses an image over 20 MB", async () => {
      await start();
      const response = await upload("x=0&y=0&size=1", Buffer.alloc(21 * 1024 * 1024, 1));
      expect(response.statusCode).toBe(413);
      expect(response.json()).toMatchObject({
        code: "too-large",
        message: "Images must be under 20 MB.",
      });
      expect(await portraitOf()).toBeUndefined();
    });

    it("refuses a crop that doesn't fit inside the image", async () => {
      await start();
      // The square is 200 px; starting 240 px in, it would run past the 400 px edge.
      const response = await upload("x=0.6&y=0&size=1", await (await halves()).png().toBuffer());
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: "invalid" });
      expect(await portraitOf()).toBeUndefined();
    });

    it("checks the crop against the rotated image, not the stored pixels", async () => {
      await start();
      // Stored 400 × 200, shown 200 × 400 (orientation 6).
      const rotated = await (await halves()).jpeg().withMetadata({ orientation: 6 }).toBuffer();
      expect((await upload("x=0.5&y=0&size=1", rotated)).statusCode).toBe(400);
      expect((await upload("x=0&y=0.5&size=1", rotated)).statusCode).toBe(200);
    });

    it("refuses a viewer", async () => {
      await start({ user: { id: "guest", role: "viewer" } });
      const response = await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "forbidden" });
    });

    it("refuses a character whose file is broken on disk", async () => {
      await start();
      await get(base); // opens the world, so the file breaks while it is loaded
      const folder = join(camelot.worldPath, "characters");
      const file = (await readdir(folder)).find((n) => n.startsWith("lancelot"))!;
      await writeFile(join(folder, file), "{ broken");
      await vi.waitFor(async () => {
        const { problems } = (await get(base)).json<WorldSnapshot>();
        expect(problems.map((p) => p.code)).toContain("invalid-json");
      }, WAIT);
      const response = await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "blocked" });
    });

    it("answers 404 for a character that isn't there", async () => {
      await start();
      const response = await upload(
        "x=0&y=0&size=1",
        await (await halves()).png().toBuffer(),
        "zzzzzzzzzzzzzzzz",
      );
      expect(response.statusCode).toBe(404);
    });
  });

  describe("what the world says afterwards", () => {
    const problems = async () => (await get(base)).json<WorldSnapshot>().problems;

    it("reports no problem for a photo it just saved", async () => {
      await start();
      await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      expect(await problems()).toEqual([]);
    });

    it("reports no problem after the photo is replaced by another format, or removed", async () => {
      await start();
      const solid = sharp({ create: { width: 300, height: 300, channels: 3, background: RED } });
      await upload("x=0&y=0&size=1", await solid.clone().jpeg().toBuffer());
      await upload("x=0&y=0&size=1", await solid.clone().png().toBuffer());
      expect(await problems()).toEqual([]);
      await remove();
      expect(await problems()).toEqual([]);
    });
  });

  describe("removing", () => {
    it("deletes the image and its thumbnail and unsets the portrait", async () => {
      await start();
      await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      await get(`${base}/assets/portraits/lancelot-${lancelot}.png.thumb.webp`);
      expect(await assets()).toEqual(
        expect.arrayContaining([`lancelot-${lancelot}.png`, `lancelot-${lancelot}.png.thumb.webp`]),
      );

      const response = await remove();
      expect(response.statusCode).toBe(200);
      expect(response.json<CommandResult>().inverse).toEqual({ commands: [] });
      expect(await portraitOf()).toBeUndefined();
      const names = await assets();
      expect(names.filter((n) => n.startsWith("lancelot"))).toEqual([]);
    });

    it("answers 404 when there is no portrait", async () => {
      await start();
      expect((await remove()).statusCode).toBe(404);
    });
  });

  describe("thumbnails", () => {
    const thumbUrl = () => `${base}/assets/portraits/lancelot-${lancelot}.png.thumb.webp`;
    const centre = async (bytes: Buffer) => {
      const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
      const at =
        (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
      return [data[at]!, data[at + 1]!, data[at + 2]!];
    };

    it("makes a 256 × 256 WebP the first time it is asked for, and keeps it", async () => {
      await start();
      await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      expect(await assets()).not.toContain(`lancelot-${lancelot}.png.thumb.webp`);

      const response = await get(thumbUrl());
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/webp");
      const meta = await sharp(response.rawPayload).metadata();
      expect([meta.width, meta.height]).toEqual([256, 256]);
      expect(await assets()).toContain(`lancelot-${lancelot}.png.thumb.webp`);
    });

    it("rebuilds it after the crop changes", async () => {
      await start();
      await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      const first = await centre((await get(thumbUrl())).rawPayload);
      expect(first[0]).toBeGreaterThan(200); // the crop covers the red half

      await new Promise((resolve) => setTimeout(resolve, 40)); // so the character file is newer
      await server.app.inject({
        method: "POST",
        url: `${base}/commands`,
        headers: AUTH,
        payload: {
          commands: [
            {
              type: "character.update",
              id: lancelot,
              set: {
                portrait: { file: `lancelot-${lancelot}.png`, crop: { x: 0.5, y: 0, size: 1 } },
              },
            },
          ],
        },
      });
      const second = await centre((await get(thumbUrl())).rawPayload);
      expect(second[2]).toBeGreaterThan(200); // now the blue half
    });

    it("answers 404 when the original is gone", async () => {
      await start();
      await upload("x=0&y=0&size=1", await (await halves()).png().toBuffer());
      await get(thumbUrl());
      await rm(join(portraits(), `lancelot-${lancelot}.png`));
      await rm(join(portraits(), `lancelot-${lancelot}.png.thumb.webp`));
      expect((await get(thumbUrl())).statusCode).toBe(404);
    });

    it("answers 404 for a thumbnail of no character's portrait", async () => {
      await start();
      expect((await get(`${base}/assets/portraits/nobody.png.thumb.webp`)).statusCode).toBe(404);
    });

    it("still serves the original", async () => {
      await start();
      const png = await (await halves()).png().toBuffer();
      await upload("x=0&y=0&size=1", png);
      const response = await get(`${base}/assets/portraits/lancelot-${lancelot}.png`);
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
      expect(Buffer.compare(response.rawPayload, png)).toBe(0);
      expect((await readFile(join(portraits(), `lancelot-${lancelot}.png`))).length).toBe(
        png.length,
      );
    });
  });
});
