import type { TransitionConfig } from "svelte/transition";

/** Durations in milliseconds, matching --motion-enter and --motion-exit in tokens.css. */
export const MOTION = { enter: 200, exit: 150 } as const;

const bezier = (a: number, b: number) => (s: number) =>
  3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
const x = bezier(0.2, 0.2);
const y = bezier(0.8, 1);
/** x'(s); the middle term vanishes because both x control points are 0.2. */
const dx = (s: number) => 3 * (1 - s) ** 2 * 0.2 + 3 * s ** 2 * 0.8;

/** cubic-bezier(.2,.8,.2,1), the "settle" curve (--ease-settle). */
export function easeSettle(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Newton's method on x(s) = t, falling back to bisection where the slope is flat.
  let s = t;
  for (let i = 0; i < 8; i++) {
    const slope = dx(s);
    if (Math.abs(slope) < 1e-6) break;
    s -= (x(s) - t) / slope;
  }
  if (Math.abs(x(s) - t) > 1e-6 || s < 0 || s > 1) {
    let [low, high] = [0, 1];
    s = t;
    while (high - low > 1e-7) {
      if (x(s) < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
  }
  return y(s);
}

const easeIn = (t: number) => t * t;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fade in while growing from 96% (design spec §7); a plain fade under reduced motion. */
export function settleIn(node: Element, params: { origin?: string } = {}): TransitionConfig {
  const reduced = reducedMotion();
  (node as HTMLElement).style.transformOrigin = params.origin ?? "top right";
  return {
    duration: MOTION.enter,
    easing: easeSettle,
    css: (t) => (reduced ? `opacity: ${t}` : `opacity: ${t}; transform: scale(${0.96 + 0.04 * t})`),
  };
}

/** Fade out while shrinking to 98%; a plain fade under reduced motion. */
export function settleOut(node: Element, params: { origin?: string } = {}): TransitionConfig {
  const reduced = reducedMotion();
  (node as HTMLElement).style.transformOrigin = params.origin ?? "top right";
  return {
    duration: MOTION.exit,
    easing: easeIn,
    css: (t) => (reduced ? `opacity: ${t}` : `opacity: ${t}; transform: scale(${0.98 + 0.02 * t})`),
  };
}
