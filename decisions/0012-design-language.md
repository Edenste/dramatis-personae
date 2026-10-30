# 0012. A Mac-native design language: tabs in the title bar, floating cards and fade-and-settle motion

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

The graph is the app's main surface, so the interface around it should stay out of the way. The app is a calm tool for writers, worldbuilders and fans, used for long sessions, and the goal is for it to feel like a native Mac app on every system: rounded corners, floating windows and smooth fades, mostly white or black, and no gradients or showy animation.

## Options considered

**Layout.** Four were mocked up and compared:

- **A floating tab bar** over a full-window graph.
- **Floating windows** for every page.
- **A fixed tab strip** with each page in a rounded panel inset from the window's edges.
- **A mix:** floating tabs with pages as sheets over the graph.

**Colour.** Three directions:

- **Paper and ink:** pure white and black, with no accent colour.
- **The same, plus a serif for names.**
- **Apple's system colours:** its greys and blue, with a charcoal dark mode.

**Type:** each system's own font, or Inter bundled with the app.

**Motion:** a plain fade, or a fade with a slight grow ("settle") from 96% to full size.

## Decision

- **Layout.** The tabs sit in the window's own title bar, and each page is a rounded panel inset from the window's edges. Any page can be the base:
  - On the Graph, clicking a character opens a **card**: a small floating window. Several can be open at once; they can be moved, resized and brought forward, and the graph behind stays usable. Cards belong to the Graph tab and reopen where they were.
  - On every other page, clicking a character opens their full page as a tab.
- **Dashboard.** Countdowns first: upcoming dates on the left, search and recent characters on the right.
- **Colour.** Apple's system palette in light and dark. The accent (`#0071E3`, and `#0A84FF` for rings in dark mode) is used only for selection, keyboard focus and a dialog's main button. Character and role colours come from the world, so the app's own controls stay neutral. Every text and background pair is checked for WCAG AA contrast by a test.
- **Type.** Inter, bundled under the SIL Open Font License, at 11, 13, 15, 22 and 28px; regular for text, semibold for names and headings; tabular figures for numbers; sentence case throughout.
- **Shape and depth.** Corners of 10px (page panel and menus), 12px (cards and dialogs), 6px (controls) and 5px (chips). Three depths: flat, raised (cards behind the front one) and floating (the front card, menus, dialogs). No gradients and no background blur.
- **Motion.** Things fade in over 200ms while growing from 96%, and fade out over 150ms; tabs cross-fade in 120ms; hover changes colour only. Nothing moves unprompted, and reduced-motion settings turn every transition into a plain fade.
- **Tokens.** Every colour, size, shadow and duration lives in `apps/web/src/styles/tokens.css`; components use only those variables.

## Consequences

- **Cards need a small window manager** (placement, clamping, stacking and persistence), covered by unit and end-to-end tests. Their open state is saved in each world's workspace file.
- **The desktop app draws its window buttons in the theme's colours** on Windows and keeps the system buttons on macOS, so the window follows the theme setting through hooks the desktop app gives the server.
- **Inter adds about 220 kB of font files** to the app but makes it look the same on every system.
- **A widget-based, editable Dashboard** is planned for later, together with custom calendars; the countdowns-first layout is the MVP's default.
- **Keyboard moving and resizing of cards** is not part of this decision and comes later.
