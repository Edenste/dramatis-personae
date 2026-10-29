const SHOWN_FOR = 4000;

/** Short messages at the bottom of the page: one at a time, gone after 4 seconds. */
export class Toasts {
  current = $state<{ id: number; message: string } | null>(null);
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string): void {
    clearTimeout(this.timer);
    const id = this.nextId++;
    this.current = { id, message };
    this.timer = setTimeout(() => {
      if (this.current?.id === id) this.current = null;
    }, SHOWN_FOR);
  }
}

export const toasts = new Toasts();
