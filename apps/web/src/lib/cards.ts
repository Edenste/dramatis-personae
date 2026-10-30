import type { CardState } from "@dramatis-personae/schema";

/** Card sizes and spacing in CSS pixels (design spec §4.2). */
export const CARD = {
  width: 280,
  minWidth: 240,
  minHeight: 140,
  inset: 12,
  cascade: 16,
  maxStored: 50,
  defaultHeight: 220,
} as const;

export interface Bounds {
  width: number;
  height: number;
}

export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

/**
 * Where the next card opens: 12px from the top-right corner, each further card
 * 16px down and left of the last, starting again once the next would leave the page.
 */
export function placeNew(
  count: number,
  bounds: Bounds,
  size: { width: number; height: number },
): { x: number; y: number } {
  const room = Math.min(
    (bounds.width - 2 * CARD.inset - size.width) / CARD.cascade,
    (bounds.height - 2 * CARD.inset - size.height) / CARD.cascade,
  );
  const fits = Math.max(1, 1 + Math.floor(room));
  const step = count % fits;
  return {
    x: Math.max(0, bounds.width - CARD.inset - size.width - step * CARD.cascade),
    y: CARD.inset + step * CARD.cascade,
  };
}

/** Shrinks a card to fit the page (never below the minimum size), then moves it inside. */
export function clampCard(card: CardState, bounds: Bounds): CardState {
  const width = Math.max(CARD.minWidth, Math.min(card.width, bounds.width));
  const height = Math.max(CARD.minHeight, Math.min(card.height, bounds.height));
  return {
    ...card,
    width,
    height,
    x: Math.max(0, Math.min(card.x, bounds.width - width)),
    y: Math.max(0, Math.min(card.y, bounds.height - height)),
  };
}

export function moveCard(card: CardState, x: number, y: number, bounds: Bounds): CardState {
  return clampCard({ ...card, x, y }, bounds);
}

/** Moves only the named edges, keeping the minimum size and staying on the page. */
export function resizeCard(
  card: CardState,
  edge: Edge,
  dx: number,
  dy: number,
  bounds: Bounds,
): CardState {
  let [left, top, right, bottom] = [card.x, card.y, card.x + card.width, card.y + card.height];
  if (edge.includes("e")) right = clamp(right + dx, left + CARD.minWidth, bounds.width);
  if (edge.includes("w")) left = clamp(left + dx, 0, right - CARD.minWidth);
  if (edge.includes("s")) bottom = clamp(bottom + dy, top + CARD.minHeight, bounds.height);
  if (edge.includes("n")) top = clamp(top + dy, 0, bottom - CARD.minHeight);
  return { ...card, x: left, y: top, width: right - left, height: bottom - top };
}

/** Front-most last. */
export function bringToFront(cards: CardState[], character: string): CardState[] {
  const card = cards.find((c) => c.character === character);
  return card ? [...cards.filter((c) => c !== card), card] : cards;
}

export function closeCard(cards: CardState[], character: string): CardState[] {
  return cards.filter((c) => c.character !== character);
}

/** Opens a character's card in front, or brings their open card forward. */
export function openCard(
  cards: CardState[],
  character: string,
  bounds: Bounds,
  height: number,
): CardState[] {
  if (cards.some((c) => c.character === character)) return bringToFront(cards, character);
  const size = { width: CARD.width, height };
  return [...cards, { character, ...placeNew(cards.length, bounds, size), ...size }];
}
