import sharp from "sharp";
import { inspectImage, makeThumbnail } from "@dramatis-personae/server";

/** Proves image processing loads and works; `--self-test-images` runs this in a packaged build. */
export async function selfTestImages(): Promise<string> {
  const original = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#3b6fd4" },
  })
    .png()
    .toBuffer();
  const thumbnail = await makeThumbnail(original, { x: 0, y: 0, size: 1 });
  const meta = await sharp(thumbnail).metadata();
  if (meta.format !== "webp" || !(await inspectImage(original))) {
    throw new Error("Thumbnail came back in an unexpected form");
  }
  return `images ok ${meta.width}x${meta.height}`;
}
