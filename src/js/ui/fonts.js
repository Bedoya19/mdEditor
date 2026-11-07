/**
 * @file fonts.js
 * Fonts offered for the EDITOR (the Markdown source). They only change how
 * the source looks on screen; they're never written into the file — Markdown
 * has no notion of fonts. This mirrors TextEdit's font popup, adapted to a
 * plain-text format.
 *
 * Each stack lists a macOS font first, then cross-platform fallbacks.
 */
export const EDITOR_FONTS = {
  mono: { label: 'Menlo', stack: 'Menlo, "SF Mono", Consolas, "Liberation Mono", monospace' },
  sans: { label: 'Helvetica Neue', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  serif: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  book: { label: 'Palatino', stack: 'Palatino, "Palatino Linotype", "Book Antiqua", serif' },
  typewriter: { label: 'American Typewriter', stack: '"American Typewriter", "Courier New", Courier, monospace' },
};

export const FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24];
