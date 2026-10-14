// Small shared helpers for anything that moves on its own clock.

// Motion plays for every visitor. It is off only when the visitor has chosen the plain version
// of the page (or the page had to fall back to it). The name is kept for the scripts that ask.
export const prefersReducedMotion = () => document.documentElement.classList.contains("plain");

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

// A time-based tween. Frame rate is never assumed. Stops early when `alive` turns false.
export function tween(duration: number, step: (t: number) => void, alive: () => boolean = () => true, ease = easeInOut) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      if (!alive()) return resolve();
      const t = clamp((now - start) / duration);
      step(ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

// Calls back when the element becomes visible or stops being visible, and when the tab is hidden or shown.
export function onVisible(element: Element, change: (visible: boolean) => void) {
  let onScreen = false;
  let state = false;
  const update = () => {
    const next = onScreen && !document.hidden;
    if (next !== state) {
      state = next;
      change(next);
    }
  };
  new IntersectionObserver(
    (entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      update();
    },
    { threshold: 0.15 },
  ).observe(element);
  document.addEventListener("visibilitychange", update);
}
