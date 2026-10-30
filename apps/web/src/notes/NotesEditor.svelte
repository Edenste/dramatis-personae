<script lang="ts">
  import { autocompletion } from "@codemirror/autocomplete";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
  import { Compartment, EditorSelection, EditorState, Transaction } from "@codemirror/state";
  import { EditorView, keymap, placeholder } from "@codemirror/view";
  import { onMount } from "svelte";
  import { toasts } from "../lib/toasts.svelte.ts";
  import type { CharacterSummary } from "../lib/world-mirror.ts";
  import { contextGroups, deleteBlockChange, toggleMarks } from "./actions.ts";
  import { turnInto, type BlockType, type TextChange } from "./blocks.ts";
  import { mentionSource, optionDecorations, slashSource } from "./completions.ts";
  import ContextMenu from "./ContextMenu.svelte";
  import LinkPopover from "./LinkPopover.svelte";
  import { livePreview } from "./live-preview.ts";
  import "./notes.css";

  let {
    body,
    editable,
    characters,
    list,
    onopen,
    onchange,
    onblur,
    thumbnail,
    toggleable = true,
  }: {
    /** The text to start with. Later changes from outside come in through `setText`. */
    body: string;
    editable: boolean;
    /** Who a character link means now, or null if they are gone. */
    characters: (id: string) => CharacterSummary | null;
    /** Every character in the world, for the `@` menu. */
    list: () => CharacterSummary[];
    onopen: (id: string) => void;
    /** Called with the whole text after every change the person makes. */
    onchange: (text: string) => void;
    /** The editor lost focus. */
    onblur?: () => void;
    thumbnail?: (id: string) => string | null;
    /** False stops the to-do boxes being ticked, for someone who can't edit. */
    toggleable?: boolean;
  } = $props();

  let host: HTMLElement | undefined = $state();
  let view: EditorView | undefined;
  /** Everything that depends on the mode or the world, so it can change without rebuilding the editor. */
  const mode = new Compartment();
  /** The undo history, in a compartment of its own so it can be emptied. */
  const undoHistory = new Compartment();

  let menu = $state<{ x: number; y: number; hasSelection: boolean } | null>(null);
  let linking = $state<{ x: number; y: number; from: number; to: number } | null>(null);

  const modeExtensions = () => [
    EditorView.editable.of(editable),
    EditorState.readOnly.of(!editable),
    ...(editable ? [placeholder("Type / for blocks, @ to link a character")] : []),
    livePreview({
      mode: editable ? "edit" : "view",
      character: characters,
      onopen,
      onopenweb: (href) => window.open(href, "_blank", "noopener"),
      ...(thumbnail ? { thumbnail } : {}),
      toggleable,
    }),
  ];

  onMount(() => {
    view = new EditorView({
      parent: host!,
      state: EditorState.create({
        doc: body,
        extensions: [
          undoHistory.of(history()),
          // The Markdown keymap (Enter continues a list, Backspace removes a marker) comes with the language.
          markdown({ base: markdownLanguage }),
          autocompletion({
            override: [slashSource, mentionSource(() => list())],
            icons: false,
            addToOptions: optionDecorations,
          }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: "true", "aria-label": "Notes" }),
          mode.of(modeExtensions()),
          EditorView.domEventHandlers({
            blur: () => {
              onblur?.();
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            // Text handed in with `setText` isn't something the person typed.
            if (
              update.docChanged &&
              !update.transactions.some((t) => t.annotation(Transaction.remote))
            ) {
              onchange(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    return () => view?.destroy();
  });

  $effect(() => {
    const extensions = modeExtensions();
    view?.dispatch({ effects: mode.reconfigure(extensions) });
  });

  /** Replaces the text, keeping the cursor where it was as far as the new text allows. */
  export function setText(text: string): void {
    if (!view || view.state.doc.toString() === text) return;
    const head = Math.min(view.state.selection.main.head, text.length);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: EditorSelection.cursor(head),
      annotations: Transaction.remote.of(true),
      // Typing from before someone else's change can't be undone across it, so the history starts over.
      effects: undoHistory.reconfigure([]),
    });
    view.dispatch({ effects: undoHistory.reconfigure(history()) });
  }

  export function getText(): string {
    return view?.state.doc.toString() ?? body;
  }

  export function focus(): void {
    view?.focus();
  }

  /** Our menu, in place of the browser's. Shift+right-click still opens the system one, for spelling. */
  function contextmenu(event: MouseEvent): void {
    if (!editable || event.shiftKey || !view) return;
    event.preventDefault();
    const { from, to } = view.state.selection.main;
    let at: number | null = null;
    try {
      at = view.posAtCoords({ x: event.clientX, y: event.clientY });
    } catch {
      // No layout to ask (a test window): leave the cursor where it is.
    }
    if (at !== null && (at < from || at > to)) view.dispatch({ selection: { anchor: at } });
    menu = { x: event.clientX, y: event.clientY, hasSelection: !view.state.selection.main.empty };
  }

  function edit(changes: TextChange[]): void {
    view?.dispatch({ changes: view.state.changes(changes), userEvent: "input" });
  }

  async function useClipboard(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      toasts.show("Couldn't use the clipboard here. Try the keyboard shortcut instead.");
    }
  }

  function choose(id: string): void {
    const opened = menu;
    menu = null;
    if (!view || !opened) return;
    const { from, to, head } = view.state.selection.main;
    const doc = view.state.doc.toString();
    if (id.startsWith("turn:")) {
      edit(turnInto(doc, from, to, id.slice("turn:".length) as BlockType));
    } else if (id === "bold") edit(toggleMarks(doc, from, to, "**"));
    else if (id === "italic") edit(toggleMarks(doc, from, to, "*"));
    else if (id === "strike") edit(toggleMarks(doc, from, to, "~~"));
    else if (id === "code") edit(toggleMarks(doc, from, to, "`"));
    else if (id === "link") {
      linking = { x: opened.x, y: opened.y, from, to };
      return;
    } else if (id === "copy") {
      void useClipboard(() => navigator.clipboard.writeText(view!.state.sliceDoc(from, to)));
    } else if (id === "cut") {
      void useClipboard(async () => {
        await navigator.clipboard.writeText(view!.state.sliceDoc(from, to));
        edit([{ from, to, insert: "" }]);
      });
    } else if (id === "paste") {
      void useClipboard(async () => {
        const text = await navigator.clipboard.readText();
        edit([{ from, to, insert: text }]);
      });
    } else if (id === "delete-block") {
      const change = deleteBlockChange(doc, head);
      if (change) edit([change]);
    }
    view.focus();
  }

  function addLink(href: string): void {
    const link = linking;
    linking = null;
    if (!view || !link) return;
    const text = view.state.sliceDoc(link.from, link.to);
    edit([{ from: link.from, to: link.to, insert: `[${text}](${href})` }]);
    view.focus();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="notes-editor" bind:this={host} oncontextmenu={contextmenu}></div>

{#if menu}
  <ContextMenu
    x={menu.x}
    y={menu.y}
    groups={contextGroups(menu.hasSelection)}
    disabled={new Set(menu.hasSelection ? [] : ["cut", "copy"])}
    onchoose={choose}
    onclose={() => {
      menu = null;
      view?.focus();
    }}
  />
{/if}

{#if linking}
  <LinkPopover
    x={linking.x}
    y={linking.y}
    onsubmit={addLink}
    onclose={() => {
      linking = null;
      view?.focus();
    }}
  />
{/if}
