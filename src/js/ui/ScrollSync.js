/**
 * @file ScrollSync.js
 * In split view, scrolling one side scrolls the other to the same relative
 * position (e.g. 40% down the source ≈ 40% down the preview).
 *
 * Proportional sync is an approximation — a long code block renders shorter
 * or taller than its source — but it's simple, has no coupling to the parser,
 * and is what most lightweight editors do.
 */
export class ScrollSync {
  /**
   * @param {HTMLElement} a
   * @param {HTMLElement} b
   */
  constructor(a, b) {
    this.enabled = true;
    // The side we last moved programmatically; its next scroll event is an
    // echo of our own change and must be ignored, or the two would ping-pong.
    let echo = null;

    const follow = (source, target) => () => {
      if (!this.enabled) return;
      if (echo === source) { echo = null; return; }
      const max = source.scrollHeight - source.clientHeight;
      const ratio = max > 0 ? source.scrollTop / max : 0;
      const nextTop = Math.round(ratio * (target.scrollHeight - target.clientHeight));
      if (Math.abs(target.scrollTop - nextTop) < 1) return;
      echo = target;
      target.scrollTop = nextTop;
    };

    a.addEventListener('scroll', follow(a, b), { passive: true });
    b.addEventListener('scroll', follow(b, a), { passive: true });
  }
}
