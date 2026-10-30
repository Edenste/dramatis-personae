/** A copy of `items` with the one at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/**
 * Which gap between rows a pointer is at, counting from 0 (above the first
 * row) to the number of rows (below the last). A pointer exactly on a row's
 * middle is still above it.
 */
export function dropGap(pointerY: number, rowTops: readonly number[], rowHeight: number): number {
  return rowTops.filter((top) => top + rowHeight / 2 < pointerY).length;
}

/** The place a row ends up in when dropped at `gap` of the list it came from. */
export function targetIndex(from: number, gap: number): number {
  return gap > from ? gap - 1 : gap;
}

export function moveAnnouncement(name: string, position: number, total: number): string {
  return `${name}, moved to position ${position} of ${total}`;
}
