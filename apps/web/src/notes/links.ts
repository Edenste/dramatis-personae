import { ID_PATTERN } from "@dramatis-personae/schema";

const PREFIX = "character:";

/** The address a Markdown link to a character carries: `[Arthur](character:<id>)`. */
export const characterHref = (id: string): string => `${PREFIX}${id}`;

/** The character a link address points to, or null if it isn't a character address. */
export function parseCharacterHref(href: string): string | null {
  if (!href.startsWith(PREFIX)) return null;
  const id = href.slice(PREFIX.length);
  return ID_PATTERN.test(id) ? id : null;
}

/** The address, if it is one a link may open: web pages and email. Anything else stays text. */
export function safeWebHref(href: string): string | null {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}
