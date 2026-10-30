import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Crop } from "@dramatis-personae/schema";
import { toasts } from "../lib/toasts.svelte.ts";
import { fromSnapshot } from "../lib/world-mirror.ts";
import { fakeActions } from "../test-utils/fakes.ts";
import { IDS, profileSnapshot, withData } from "../test-utils/fixtures.ts";
import CropSheet from "./CropSheet.svelte";
import PortraitMenu from "./PortraitMenu.svelte";
import { profileView } from "./profile-view.ts";

const portrait = { file: "lancelot-x.png", crop: { x: 0.1, y: 0, size: 0.5 } };

function viewOf(withPortrait: boolean) {
  const snapshot = profileSnapshot();
  if (withPortrait) {
    snapshot.files = snapshot.files.map((f) =>
      f.ref.kind === "character" && f.ref.id === IDS.lancelot ? withData(f, { portrait }) : f,
    );
  }
  return profileView(fromSnapshot(snapshot), IDS.lancelot)!;
}

function mount(withPortrait = false, overrides = {}) {
  const fake = fakeActions(overrides);
  render(PortraitMenu, { view: viewOf(withPortrait), actions: fake.actions });
  return fake;
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Change Lancelot's photo" }));

/** An image element that has loaded at this size, as a browser would report it. */
async function loaded(img: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  await fireEvent.load(img);
}

beforeEach(() => {
  toasts.current = null;
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("PortraitMenu", () => {
  it("offers only Change photo and Colour when there is no photo", async () => {
    mount(false);
    await open();
    expect(screen.getByRole("menuitem", { name: "Change photo…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Colour" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Adjust crop…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Remove photo" })).toBeNull();
  });

  it("offers Adjust crop and Remove photo when there is one", async () => {
    mount(true);
    await open();
    expect(screen.getByRole("menuitem", { name: "Adjust crop…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove photo" })).toBeTruthy();
  });

  describe("removing", () => {
    it("asks first, saying it can't be undone, and removes nothing yet", async () => {
      const removePortrait = vi.fn(() => Promise.resolve(true));
      mount(true, { removePortrait });
      await open();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Remove photo" }));
      expect(screen.getByRole("heading", { name: "Remove Lancelot's photo?" })).toBeTruthy();
      expect(screen.getByText("This can't be undone.")).toBeTruthy();
      expect(removePortrait).not.toHaveBeenCalled();
    });

    it("calls removePortrait for the character on Remove", async () => {
      const removePortrait = vi.fn(() => Promise.resolve(true));
      mount(true, { removePortrait });
      await open();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Remove photo" }));
      await fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      expect(removePortrait).toHaveBeenCalledExactlyOnceWith(IDS.lancelot);
    });

    it("does nothing on Cancel", async () => {
      const removePortrait = vi.fn(() => Promise.resolve(true));
      mount(true, { removePortrait });
      await open();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Remove photo" }));
      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(removePortrait).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: /Remove Lancelot/ })).toBeNull();
    });
  });

  describe("choosing a photo", () => {
    const pick = async (file: File) => {
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await fireEvent.change(input, { target: { files: [file] } });
    };

    it("refuses a file over 20 MB without opening the sheet", async () => {
      mount(true);
      await pick(new File([new Uint8Array(21 * 1024 * 1024)], "big.png", { type: "image/png" }));
      expect(toasts.current?.message).toBe("Images must be under 20 MB.");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens the crop sheet, and uploads the bytes with the crop on Save", async () => {
      const setPortrait = vi.fn(() => Promise.resolve(true));
      mount(true, { setPortrait });
      await pick(new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      expect(screen.getByText("This replaces Lancelot's current photo.")).toBeTruthy();
      await loaded(screen.getByRole("dialog").querySelector("img")!, 400, 200);
      await fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(setPortrait).toHaveBeenCalledOnce());
      const [id, bytes, crop] = setPortrait.mock.calls[0] as unknown as [
        string,
        Uint8Array,
        object,
      ];
      expect(id).toBe(IDS.lancelot);
      expect([...bytes]).toEqual([1, 2, 3]);
      expect(crop).toEqual({ x: 0.25, y: 0, size: 1 });
    });

    it("uploads nothing on Cancel", async () => {
      const setPortrait = vi.fn(() => Promise.resolve(true));
      mount(false, { setPortrait });
      await pick(new File([new Uint8Array([1])], "photo.png", { type: "image/png" }));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      expect(screen.queryByText(/replaces Lancelot/)).toBeNull();
      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(setPortrait).not.toHaveBeenCalled();
    });
  });

  describe("adjusting the crop", () => {
    it("saves the new crop as an ordinary, undoable edit", async () => {
      const { batches } = mount(true);
      await open();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Adjust crop…" }));
      await loaded(screen.getByRole("dialog").querySelector("img")!, 400, 200);
      const circle = screen.getByRole("button", { name: "Crop area" });
      await fireEvent.keyDown(circle, { key: "ArrowRight" });
      await fireEvent.click(screen.getByRole("button", { name: "Save" }));
      const update = batches[0]!.commands[0] as {
        set: { portrait: { file: string; crop: { x: number; size: number } } };
      };
      expect(update.set.portrait.file).toBe("lancelot-x.png");
      // 0.01 of the 200 px shorter side is 2 px, which is 0.005 of the 400 px width.
      expect(update.set.portrait.crop.x).toBeCloseTo(0.105);
      expect(update.set.portrait.crop.size).toBe(0.5);
    });
  });

  describe("colour", () => {
    async function openColour() {
      const fake = mount(false);
      await open();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Colour" }));
      return fake;
    }

    it("shows where the current colour comes from", async () => {
      await openColour();
      expect(screen.getByText("From Knights of the Round Table")).toBeTruthy();
    });

    it("chooses Automatic", async () => {
      const { batches } = await openColour();
      await fireEvent.click(screen.getByRole("menuitemradio", { name: /Automatic/ }));
      expect(batches[0]!.commands).toEqual([
        { type: "character.update", id: IDS.lancelot, set: { color: null } },
      ]);
    });

    it("chooses a system colour", async () => {
      const { batches } = await openColour();
      await fireEvent.click(screen.getByRole("button", { name: "Blue" }));
      expect(batches[0]!.commands).toEqual([
        { type: "character.update", id: IDS.lancelot, set: { color: "#007AFF" } },
      ]);
    });
  });
});

describe("CropSheet", () => {
  const props = (extra = {}) => ({
    name: "Lancelot",
    src: "blob:x",
    initial: null,
    replacing: false,
    onsave: vi.fn(),
    oncancel: vi.fn(),
    ...extra,
  });

  it("cancels on Escape", async () => {
    const p = props();
    render(CropSheet, p);
    await fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledOnce();
  });

  it("moves the circle with the arrow keys, ten times as far with Shift", async () => {
    const p = props();
    const { container } = render(CropSheet, p);
    await loaded(container.querySelector("img")!, 400, 200);
    const circle = screen.getByRole("button", { name: "Crop area" });
    await fireEvent.keyDown(circle, { key: "ArrowLeft", shiftKey: true });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // The circle started at x 0.25; Shift+Left moves 0.1 of 200 px = 20 px = 0.05 of 400 px.
    expect((p.onsave.mock.calls[0]![0] as Crop).x).toBeCloseTo(0.2);
  });

  it("sizes the circle with the zoom slider", async () => {
    const p = props();
    const { container } = render(CropSheet, p);
    await loaded(container.querySelector("img")!, 400, 200);
    await fireEvent.input(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((p.onsave.mock.calls[0]![0] as Crop).size).toBeCloseTo(0.5);
  });

  it("starts from the crop it is given", async () => {
    const p = props({ initial: { x: 0.1, y: 0, size: 0.5 } });
    const { container } = render(CropSheet, p);
    await loaded(container.querySelector("img")!, 400, 200);
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(p.onsave).toHaveBeenCalledWith({ x: 0.1, y: 0, size: 0.5 });
  });

  it("can't save before the image has loaded", () => {
    render(CropSheet, props());
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled).toBe(true);
  });
});
