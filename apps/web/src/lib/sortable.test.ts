import { describe, expect, it } from "vitest";
import { dropGap, moveAnnouncement, moveItem, targetIndex } from "./sortable.ts";

describe("moveItem", () => {
  it("moves an item to a new place, leaving the rest in order", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("doesn't change the list it was given", () => {
    const items = ["a", "b"];
    moveItem(items, 0, 1);
    expect(items).toEqual(["a", "b"]);
  });
});

describe("dropGap", () => {
  const tops = [0, 30, 60];

  it("finds the gap by the rows' middles", () => {
    expect(dropGap(0, tops, 30)).toBe(0);
    expect(dropGap(45, tops, 30)).toBe(1); // exactly on a middle: before that row
    expect(dropGap(46, tops, 30)).toBe(2);
    expect(dropGap(500, tops, 30)).toBe(3);
  });
});

describe("targetIndex", () => {
  it("turns a gap in the original list into the item's final place", () => {
    expect(targetIndex(0, 2)).toBe(1); // dropped after the second row: it ends up second
    expect(targetIndex(0, 3)).toBe(2);
    expect(targetIndex(2, 1)).toBe(1);
    expect(targetIndex(1, 1)).toBe(1);
    expect(targetIndex(1, 2)).toBe(1); // the gap right after itself is where it already is
  });
});

describe("moveAnnouncement", () => {
  it("says where the item went", () => {
    expect(moveAnnouncement("Knight", 2, 3)).toBe("Knight, moved to position 2 of 3");
  });
});
