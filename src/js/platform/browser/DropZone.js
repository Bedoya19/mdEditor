/**
 * @file DropZone.js
 * BROWSER drag & drop: detects a file dragged over / dropped on an element
 * using the HTML5 drag events.
 *
 * Why does this live in platform/browser? The desktop app receives drops
 * natively from Tauri (with real file paths, so it can save in place), and
 * the HTML5 events never fire there. Each platform provides its own drop
 * source with the same two callbacks; see createBrowserPlatform().watchDrops.
 *
 * It only detects the gesture. Showing the overlay and opening the file are
 * decided by whoever passes the callbacks (index.js / DocumentController).
 */
export class DropZone {
  /**
   * @param {HTMLElement} target  Area that accepts drops.
   * @param {Object} handlers
   * @param {(isHovering: boolean) => void} handlers.onHover  A file is (no longer) over the target.
   * @param {(dataTransfer: DataTransfer) => void} handlers.onDrop
   */
  constructor(target, { onHover, onDrop }) {
    // dragenter/leave fire for every child element; a counter tells us when
    // the pointer has truly left the target.
    let depth = 0;
    const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');

    target.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (depth++ === 0) onHover(true);
    });
    target.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); // required, otherwise "drop" never fires
      event.dataTransfer.dropEffect = 'copy';
    });
    target.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) onHover(false);
    });
    target.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      onHover(false);
      onDrop(event.dataTransfer); // synchronous on purpose, see FileService.openIncoming
    });
  }
}
