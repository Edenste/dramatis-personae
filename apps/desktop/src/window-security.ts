/** Navigation rules for the app window. Kept free of Electron so they can be tested directly. */

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True only for a URL on the app's own origin: same scheme, host and port. */
export function isAppUrl(url: string, appOrigin: string): boolean {
  return parse(url)?.origin === parse(appOrigin)?.origin;
}

/** A link to open in the system browser instead: http(s) on another origin, else null. */
export function externalUrlToOpen(url: string, appOrigin: string): string | null {
  const parsed = parse(url);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return null;
  return isAppUrl(url, appOrigin) ? null : parsed.href;
}
