import { describe, expect, it } from "vitest";
import { externalUrlToOpen, isAppUrl } from "./window-security.ts";

const app = "http://127.0.0.1:51234";

describe("isAppUrl", () => {
  it("accepts only the app's own origin", () => {
    expect(isAppUrl(`${app}/w/x/graph`, app)).toBe(true);
    expect(isAppUrl(`${app}/`, app)).toBe(true);
  });

  it.each([
    "http://127.0.0.1:9999/",
    "http://localhost:51234/",
    "https://127.0.0.1:51234/",
    "file:///C:/x",
    "https://evil.example/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isAppUrl(url, app)).toBe(false);
  });
});

describe("externalUrlToOpen", () => {
  it("opens web links on other sites in the browser", () => {
    expect(externalUrlToOpen("https://example.org/a", app)).toBe("https://example.org/a");
    expect(externalUrlToOpen("http://example.org/", app)).toBe("http://example.org/");
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", `${app}/w/x`, "mailto:a@example.org", "x"])(
    "never opens %s",
    (url) => {
      expect(externalUrlToOpen(url, app)).toBeNull();
    },
  );
});
