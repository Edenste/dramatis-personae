# 0013. CodeMirror 6 with a live preview for character notes

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

A character's notes are one Markdown string in the character's file. Writers edit them in the app, and also by hand or with other tools, so the app must never rewrite text it was not asked to change: a body written with `*` bullets or Windows line endings must come back exactly as it was unless the writer edits it.

The editor should feel like a modern notes app: typing `# ` makes a heading, `- ` starts a list, `/` offers blocks, `@` links a character, and a right-click menu offers formatting and moving a block.

## Options considered

- **TipTap 3 (ProseMirror).** Rich-text editing with ready-made block menus and a Markdown converter. The editor's document is not Markdown, so the text is written out again on every save: bullets, spacing and line endings are normalised, and unusual constructs can be lost.
- **Milkdown (ProseMirror).** Treats Markdown as the source of truth, so files round-trip better. It has a smaller community and a harder plugin API, and its Notion-style kit brings a look that would have to be stripped back.
- **CodeMirror 6 with a live preview,** in the way Obsidian does it. The document is the Markdown text itself, drawn as styled blocks with the markup hidden except on the line being edited.

## Decision

CodeMirror 6 with `@codemirror/lang-markdown`, a live-preview extension built on its Markdown syntax tree, `@codemirror/autocomplete` for the `/` block menu and the `@` character menu, and a right-click menu drawn by the app.

- **The text is never re-serialised.** What is saved is what is in the editor, with `\n` line endings.
- **Character links are ordinary Markdown links** with a `character:<id>` address, so any other tool shows them as links. The app draws them as the character's name and portrait, and shows a deleted character's name struck through.
- **Links to the web** open only for `http:`, `https:` and `mailto:` addresses.
- **Saving.** Notes save 800 ms after typing stops, when the editor loses focus and when the page closes. A save carries the fingerprint of the file it was based on; if the file changed underneath, the writer chooses to keep their version or take the one on disk.

## Consequences

- **Markup shows on the line being edited,** as in Obsidian, rather than being hidden everywhere as in a rich-text editor.
- **The right-click menu replaces the browser's,** so spelling suggestions are not in it. Shift+right-click opens the system menu, which has them.
- **Tables, images and HTML in a body** are shown as plain text; they are kept as written.
- **CodeMirror's own undo** handles typing while the editor has focus; the title bar's undo handles whole saved changes.
