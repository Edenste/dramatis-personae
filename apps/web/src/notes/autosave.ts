/** How a save turned out: saved (with the file's new fingerprint), conflicted, or failed. */
export type SaveOutcome = { ok: true; fingerprint: string } | { ok: false; conflict: boolean };

export interface AutosaveOptions {
  /**
   * Saves the text. `expectFingerprint` is the fingerprint the file must still
   * have, or null to overwrite it whatever it holds.
   */
  save: (text: string, expectFingerprint: string | null) => Promise<SaveOutcome>;
  /** How long after the last change to save. Default 800 ms. */
  delayMs?: number;
}

/** The editor reports `\n` line endings, so a body written with `\r\n` is compared as if it used them too. */
const unix = (text: string) => text.replace(/\r\n?/g, "\n");

/**
 * Saves the notes as they are typed: 800 ms after the last change, when the
 * editor is left, and when the page closes. It remembers the file's fingerprint
 * so a save can say what it expects, and decides what to do with a change that
 * arrives from outside (profiles spec §5.6).
 */
export class NotesAutosave {
  /** Called when a save found the file changed underneath it. Nothing more is sent until `resolve`. */
  onconflict: (() => void) | null = null;

  /** The text last saved or received: what the file holds as far as this editor knows. */
  private text: string;
  /** The fingerprint a save expects the file to have; null to overwrite. */
  private base: string | null;
  /** Typed but not saved. */
  private pending: string | null = null;
  private inFlight: { text: string; done: Promise<void> } | null = null;
  private conflicted = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly delay: number;

  constructor(
    private readonly options: AutosaveOptions,
    initial: { body: string; fingerprint: string },
  ) {
    this.text = unix(initial.body);
    this.base = initial.fingerprint;
    this.delay = options.delayMs ?? 800;
  }

  /** True while there is text that isn't saved yet, or a save on its way. */
  get dirty(): boolean {
    return this.pending !== null || this.inFlight !== null;
  }

  /** The person changed the text. */
  edit(text: string): void {
    const next = unix(text);
    // Typed back to what the file holds (or is about to hold): nothing to save.
    if (next === (this.inFlight?.text ?? this.text)) {
      this.pending = null;
      clearTimeout(this.timer);
      return;
    }
    this.pending = next;
    this.schedule();
  }

  /** Saves what is waiting now; used when the editor is left or the page is closing. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    while (this.inFlight) await this.inFlight.done;
    if (this.pending !== null && !this.conflicted) await this.run();
  }

  /**
   * The file changed (its fingerprint is new), and this is its body. "apply"
   * means show it; "keep" means leave the editor alone, because the change is
   * this editor's own save coming back, or there is unsaved text it mustn't wipe.
   */
  remote(body: string, fingerprint: string): "apply" | "keep" {
    const incoming = unix(body);
    if (fingerprint === this.base) return "keep";
    // Our own save, announced before its reply arrives.
    if (this.inFlight && incoming === this.inFlight.text) {
      this.base = fingerprint;
      return "keep";
    }
    if (incoming === this.text) {
      this.base = fingerprint;
      return "keep";
    }
    // Unsaved text waits; its next save meets the conflict and the person chooses.
    if (this.pending !== null || this.inFlight) return "keep";
    this.text = incoming;
    this.base = fingerprint;
    return "apply";
  }

  /** The person's answer to a conflict. `theirs` takes the version now on disk. */
  async resolve(
    choice: "mine" | "theirs",
    theirs?: { body: string; fingerprint: string },
  ): Promise<void> {
    this.conflicted = false;
    if (choice === "mine") {
      this.base = null; // overwrite whatever is there
      await this.run();
      return;
    }
    clearTimeout(this.timer);
    this.pending = null;
    if (theirs) {
      this.text = unix(theirs.body);
      this.base = theirs.fingerprint;
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), this.delay);
  }

  private async run(): Promise<void> {
    if (this.inFlight || this.pending === null || this.conflicted) return;
    const sending = this.pending;
    const done = this.send(sending);
    this.inFlight = { text: sending, done };
    await done;
  }

  private async send(sending: string): Promise<void> {
    const outcome = await this.options.save(sending, this.base);
    this.inFlight = null;
    if (outcome.ok) {
      this.text = sending;
      this.base = outcome.fingerprint;
      if (this.pending === sending) this.pending = null;
      // More was typed while this saved.
      if (this.pending !== null) this.schedule();
    } else if (outcome.conflict) {
      this.conflicted = true;
      this.onconflict?.();
    }
    // Any other failure leaves the text pending: the next change or flush tries again.
  }
}
