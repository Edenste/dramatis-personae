# 0014. `sharp` on the server for portraits

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

A character's portrait can be a JPEG, PNG, WebP, GIF or AVIF, chosen by the writer and cropped to a circle. The graph and the profile show a small square thumbnail of the crop, and a thumbnail that is missing or older than the character's file must be rebuilt, because the files are plain files that can be edited or copied by hand.

Photos from phones carry a rotation in their metadata, animated GIFs and AVIFs must give a still image, and files must be checked by what they contain, not by their extension.

## Options considered

- **Crop in the browser and upload the result.** No native dependency. But the server could never rebuild a missing or stale thumbnail, and it would have to trust what the browser says an image is.
- **`sharp` on the server.** The standard Node image library. It reads all five formats, applies the rotation, takes the first frame, and writes WebP. It is a native dependency, which has to be packaged with the desktop app.

## Decision

`sharp` on the server.

- **One portrait file per character,** `<name>-<id>.<ext>`, overwritten when a new photo is chosen. The 256 × 256 WebP thumbnail sits beside it and is made when it is asked for and is missing or older than the character's file.
- **Uploads are checked** by their contents (SVG and anything unsupported are refused), limited to 20 MB, and the crop is checked against the upright image.
- **Replacing or removing a photo cannot be undone,** because the old image is gone. The interface asks first. Adjusting the crop is an ordinary, undoable change.
- **In the desktop app,** `sharp` and its binaries are copied next to the bundled server and unpacked from the app archive. A hidden `--self-test-images` flag makes a thumbnail and exits, so a packaged build can be checked without opening a window.

## Consequences

- **The installer carries one native library per platform,** and each platform's build must be checked once with `--self-test-images`.
- **The crop is stored as fractions of the upright image,** so it keeps meaning whatever size the original is.
- **Old portrait files are not cleaned up** when a photo changes format; only the character's own current file is kept.
