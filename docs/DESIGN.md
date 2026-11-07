# Visual design

## Concept

**TextEdit's layout and behaviour, drawn in the Aqua style of Mac OS X 10.4–10.7.**

TextEdit gives us the *structure*: a title bar with the document name and
"— Edited", a single formatting bar (paragraph-style popup, B/I/U, lists),
a ruler, and a white page. The skeuomorphic part means each surface looks like
the physical thing it stands for:

| Surface              | Imitates                       | How it's done (all CSS, no image files) |
| -------------------- | ------------------------------ | --------------------------------------- |
| Page background      | Dark linen (OS X Lion desktop) | Two crossed 1px repeating gradients + SVG noise + radial light |
| Title bar + toolbar  | Brushed aluminium              | SVG `feTurbulence` noise stretched horizontally (`baseFrequency=".003 .9"`) over a grey gradient |
| Traffic lights       | **Current macOS**, on purpose  | Flat 12px discs with a 0.5px darker rim and SVG hover glyphs (×, −, full-screen arrows). They already look physical, so restyling them in Aqua style would only make them look less native. **In the desktop app, macOS draws the real ones** and the CSS ones are hidden |
| Buttons              | Glossy plastic pills           | Two-tone gradient with a hard midline, light lip underneath, inset shadow when pressed |
| Selected segment / default button | Aqua blue "jelly" | Blue two-tone gradient; the default dialog button gently pulses, as Aqua's did |
| Popups               | Aqua pop-up buttons            | Real `<select>` with a blue cap holding ⌃⌄ arrows |
| Ruler                | Printed ruler                  | Three repeating tick gradients (inch / half / eighth) + numbers from JS |
| Desk behind pages    | Grey felt                      | Grain + gradient + inner shadow under the toolbar |
| Source sheet         | Notebook paper                 | Ruled lines and a red margin that scroll with the text (`background-attachment: local`), spaced to match the line height |
| Preview sheet        | Printed page                   | Slightly warmer paper, book-style serif headings, recessed code cards, photo-mounted images |
| Save dialog          | Mac "sheet"                    | `<dialog>` that slides down from under the toolbar instead of floating in the middle |

## Why these choices

- **Every visual value is a token** (`css/tokens.css`). Component stylesheets
  never hard-code a brand colour or texture, so restyling, or adding a dark
  "graphite" theme, starts and mostly ends in that one file.
- **Textures are inline SVG noise, not bitmaps.** They stay sharp at any zoom,
  weigh about 1 KB, and need no asset pipeline.
- **The paper uses a much fainter grain than the desk.** Paper has to read as
  *white*. Heavy grain makes it look dirty grey.
- **Lucida Grande for the UI.** It was the Aqua system font and still ships
  with macOS. Other systems fall back to their native UI font.
- **Light theme only, on purpose.** The style imitates physical materials
  (paper, aluminium) that don't have a "dark" version. The tokens leave room
  to add one later.
- **One stylesheet per component**, imported in cascade order by
  `styles.css`, so each rule is easy to find.

## TextEdit features we adapted

| TextEdit                    | Here | Why |
| --------------------------- | ---- | --- |
| Font family and size popups | Change the **editor's display font** only | Markdown has no fonts, so this is a viewing preference and isn't saved into the file |
| Paragraph-style popup (¶)   | Body, Heading 1–6, Quote | These are Markdown's paragraph styles. The popup follows the caret, like TextEdit's does |
| B / I / U                   | B / I / S / `</>` | Markdown has no underline, but it does have strikethrough and code |
| Alignment buttons           | Left out | Markdown can't express alignment (except in table columns) |
| List popup                  | Three list buttons | Bulleted, numbered and checklist are Markdown's list types |
| Ruler                       | Kept, decorative, can be hidden | It's a big part of the TextEdit look |
| "— Edited", dot in the close button | Kept | The standard macOS sign of unsaved changes |

## Accessibility

- Real `<button>`, `<select>` and `<dialog>` elements give full keyboard and
  screen-reader support.
- `aria-pressed` on toggle buttons, `aria-live` for status messages, and
  labels on every icon-only button.
- Keyboard users see Aqua's blue focus glow (`:focus-visible`, so mouse users
  don't get it).
- The editor captures Tab for indentation. **Esc, then Tab** leaves the editor,
  so keyboard focus is never trapped.
- `prefers-reduced-motion` turns off the sheet slide and the button pulse.
- Narrow windows: the toolbar scrolls sideways and side-by-side becomes stacked.
