// jsdom has no matchMedia; tests that need a match stub it themselves.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no Web Animations API, which Svelte's transitions use: finish at once.
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    const animation = {
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null,
      currentTime: 0,
      playState: "finished",
      finished: Promise.resolve(),
      cancel() {},
      finish() {},
      play() {},
      pause() {},
    };
    queueMicrotask(() => animation.onfinish?.());
    return animation as unknown as Animation;
  };
}

// jsdom has no ResizeObserver; measuring is left to the component's first synchronous read.
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
