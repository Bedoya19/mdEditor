/**
 * @file PinchZoom.js
 * Trackpad pinch (and Ctrl + mouse wheel) zooms the pages smoothly.
 *
 * Browsers report a pinch in two different ways:
 *  - Chrome/Edge (and Ctrl + wheel everywhere): `wheel` events with
 *    `ctrlKey` set; deltaY < 0 means "fingers apart" (zoom in).
 *  - Safari's engine, which the macOS desktop app uses: `gesturestart` /
 *    `gesturechange` events carrying a `scale` relative to the gesture start.
 * Both are turned into a zoom value; the caller decides where it's stored
 * (index.js sends it to the `view.setZoom` command → Preferences).
 *
 * `preventDefault()` stops the browser from zooming the WHOLE page
 * (toolbar included) instead of just the paper.
 */
export class PinchZoom {
  /**
   * @param {HTMLElement} target  Area that reacts to pinches (the workspace).
   * @param {{getZoom: () => number, setZoom: (zoom: number) => void}} handlers
   */
  constructor(target, { getZoom, setZoom }) {
    target.addEventListener('wheel', (event) => {
      if (!event.ctrlKey) return; // a normal scroll
      event.preventDefault();
      setZoom(getZoom() * Math.exp(-event.deltaY / 100));
    }, { passive: false }); // passive listeners can't preventDefault

    let startZoom = 1;
    target.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      startZoom = getZoom();
    });
    target.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      setZoom(startZoom * event.scale);
    });
  }
}
