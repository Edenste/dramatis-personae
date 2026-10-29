import { ID_PATTERN } from "@dramatis-personae/schema";

/** A tab's address within a world (spec §11): the part of the URL after /w/<world>/. */
export type TabAddress = "graph" | "dashboard" | "problems" | `character/${string}`;

/** Always open, in this order, and never closed. */
export const PINNED: readonly TabAddress[] = ["graph", "dashboard"];

export function isTabAddress(value: string): value is TabAddress {
  if (value === "graph" || value === "dashboard" || value === "problems") return true;
  const id = /^character\/(.+)$/.exec(value)?.[1];
  return id !== undefined && ID_PATTERN.test(id);
}

export function parseLocation(pathname: string): { world: string; tab: TabAddress } | null {
  const match = /^\/w\/([^/]+)\/(.+)$/.exec(pathname);
  if (!match) return null;
  const [, world = "", tab = ""] = match;
  if (!ID_PATTERN.test(world) || !isTabAddress(tab)) return null;
  return { world, tab };
}

export function locationFor(world: string, tab: TabAddress): string {
  return `/w/${world}/${tab}`;
}

/** Valid tabs, once each, with the pinned tabs first. */
export function normaliseTabs(tabs: readonly string[]): TabAddress[] {
  const rest = tabs.filter((tab): tab is TabAddress => isTabAddress(tab) && !PINNED.includes(tab));
  return [...PINNED, ...new Set(rest)];
}
