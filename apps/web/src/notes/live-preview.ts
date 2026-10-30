import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { mount, unmount } from "svelte";
import CharacterLink from "../components/CharacterLink.svelte";
import type { CharacterSummary } from "../lib/world-mirror.ts";
import { previewRanges, type PreviewRange } from "./preview.ts";

export interface LivePreviewOptions {
  /** View mode hides all markup and lets links open; edit mode shows markup on the cursor's line. */
  mode: "view" | "edit";
  /** Who a character link means now, or null if they are gone. */
  character: (id: string) => CharacterSummary | null;
  /** Their thumbnail address, if they have a portrait. */
  thumbnail?: (id: string) => string | null;
  /** False draws the to-do boxes but won't let them be ticked (no edit access). Default true. */
  toggleable?: boolean;
  onopen: (id: string) => void;
  onopenweb: (href: string) => void;
}

class Bullet extends WidgetType {
  eq(other: WidgetType): boolean {
    return other instanceof Bullet;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-dp-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

/** A checkbox that ticks and unticks the `[ ]` it stands for, in either mode. */
class Checkbox extends WidgetType {
  constructor(
    readonly checked: boolean,
    /** Where the `[` is. */
    readonly at: number,
    readonly enabled: boolean,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof Checkbox &&
      other.checked === this.checked &&
      other.at === this.at &&
      other.enabled === this.enabled
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-dp-check";
    box.checked = this.checked;
    box.disabled = !this.enabled;
    box.setAttribute("aria-label", "Done");
    box.addEventListener("change", () => {
      view.dispatch({
        changes: { from: this.at + 1, to: this.at + 2, insert: box.checked ? "x" : " " },
        userEvent: "input.toggle",
      });
    });
    return box;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** A character link drawn as the Notion-style link, in place of its Markdown. */
class CharacterChip extends WidgetType {
  private instance: ReturnType<typeof mount> | undefined;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly character: CharacterSummary | null,
    readonly thumbnail: string | null,
    readonly options: Pick<LivePreviewOptions, "mode" | "onopen">,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof CharacterChip &&
      other.id === this.id &&
      other.label === this.label &&
      other.character?.name === this.character?.name &&
      other.character?.color === this.character?.color &&
      other.thumbnail === this.thumbnail &&
      other.options.mode === this.options.mode
    );
  }

  toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-dp-chip";
    this.instance = mount(CharacterLink, {
      target: element,
      props: {
        character: this.character,
        label: this.label,
        thumbnail: this.thumbnail,
        // While editing, a click puts the cursor there, to edit the link; it doesn't open it.
        onopen: (id: string) => {
          if (this.options.mode === "view") this.options.onopen(id);
        },
      },
    });
    return element;
  }

  destroy(): void {
    if (this.instance) void unmount(this.instance);
  }

  ignoreEvent(): boolean {
    return this.options.mode === "view";
  }
}

function lineStartsIn(view: EditorView, from: number, to: number): number[] {
  const starts: number[] = [];
  for (let line = view.state.doc.lineAt(from); ; line = view.state.doc.line(line.number + 1)) {
    starts.push(line.from);
    if (line.to >= to || line.number >= view.state.doc.lines) break;
  }
  return starts;
}

function decorate(
  view: EditorView,
  options: LivePreviewOptions,
): { all: DecorationSet; atomic: DecorationSet } {
  const { doc, selection } = view.state;
  const active = new Set<number>();
  if (options.mode === "edit" && view.hasFocus) {
    for (const range of selection.ranges) {
      for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(range.to).number; n += 1) {
        active.add(n);
      }
    }
  }

  const all: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const replace = (from: number, to: number, decoration: Decoration) => {
    all.push(decoration.range(from, to));
    atomic.push(decoration.range(from, to));
  };
  const mark = (r: PreviewRange, cls: string, attributes?: Record<string, string>) =>
    all.push(
      Decoration.mark({ class: cls, ...(attributes ? { attributes } : {}) }).range(r.from, r.to),
    );
  const lines = (r: PreviewRange, cls: string) => {
    for (const start of lineStartsIn(view, r.from, r.to)) {
      all.push(Decoration.line({ class: cls }).range(start));
    }
  };

  for (const r of previewRanges(doc.toString(), active, options.mode)) {
    switch (r.kind) {
      case "hide":
        replace(r.from, r.to, Decoration.replace({}));
        break;
      case "heading":
        lines(r, `cm-dp-h${r.level}`);
        break;
      case "bullet":
        lines({ ...r, to: r.from }, "cm-dp-li");
        replace(r.from, r.to, Decoration.replace({ widget: new Bullet() }));
        break;
      case "ordered":
        lines({ ...r, to: r.from }, "cm-dp-li");
        mark(r, "cm-dp-ordered");
        break;
      case "task":
        lines({ ...r, to: r.from }, "cm-dp-li");
        replace(
          r.from,
          r.to,
          Decoration.replace({
            widget: new Checkbox(r.checked === true, r.at ?? r.from, options.toggleable !== false),
          }),
        );
        break;
      case "quote":
        lines(r, "cm-dp-quote");
        break;
      case "divider":
        lines(r, "cm-dp-hr");
        break;
      case "code-block":
        lines(r, "cm-dp-code");
        break;
      case "inline-code":
        mark(r, "cm-dp-code-inline");
        break;
      case "bold":
        mark(r, "cm-dp-bold");
        break;
      case "italic":
        mark(r, "cm-dp-italic");
        break;
      case "strike":
        mark(r, "cm-dp-strike");
        break;
      case "web-link":
        mark(r, "cm-dp-link", { "data-href": r.href ?? "" });
        break;
      case "character-link": {
        const id = r.id ?? "";
        replace(
          r.from,
          r.to,
          Decoration.replace({
            widget: new CharacterChip(
              id,
              r.label ?? "",
              options.character(id),
              options.thumbnail?.(id) ?? null,
              options,
            ),
          }),
        );
        break;
      }
      case "plain-link":
        break;
    }
  }
  return { all: Decoration.set(all, true), atomic: Decoration.set(atomic, true) };
}

/**
 * The notes' live preview: Markdown drawn as headings, lists, links and the
 * rest, with its markup hidden except on the line being edited. The text itself
 * is never changed (profiles spec §5.2).
 */
export function livePreview(options: LivePreviewOptions): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      atomic: DecorationSet;

      constructor(view: EditorView) {
        ({ all: this.decorations, atomic: this.atomic } = decorate(view, options));
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          ({ all: this.decorations, atomic: this.atomic } = decorate(update.view, options));
        }
      }
    },
    {
      decorations: (value) => value.decorations,
      // The cursor steps over hidden markup and chips as one piece.
      provide: (value) =>
        EditorView.atomicRanges.of((view) => view.plugin(value)?.atomic ?? Decoration.none),
    },
  );

  const clicks = EditorView.domEventHandlers({
    click(event) {
      if (options.mode !== "view") return false;
      const link = (event.target as HTMLElement).closest(".cm-dp-link");
      const href = link?.getAttribute("data-href");
      if (!href) return false;
      options.onopenweb(href);
      return true;
    },
  });

  return [plugin, clicks];
}
