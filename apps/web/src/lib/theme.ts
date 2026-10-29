import type { Theme } from "@dramatis-personae/schema";

/** The theme to draw: an explicit choice, or the system's for "system". */
export function resolveTheme(setting: Theme, prefersDark: boolean): "light" | "dark" {
  if (setting === "system") return prefersDark ? "dark" : "light";
  return setting;
}

/** Switches the design tokens (tokens.css) to a theme. */
export function applyTheme(resolved: "light" | "dark"): void {
  document.documentElement.dataset.theme = resolved;
}
