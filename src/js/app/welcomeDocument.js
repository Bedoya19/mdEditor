/**
 * @file welcomeDocument.js
 * The document shown on launch. Embedded as a JS string (not fetched from a
 * .md file) so it also works when the app is opened from disk inside a
 * desktop shell, where fetch() of local files is often blocked.
 */
export const WELCOME_NAME = 'Welcome.md';

export const WELCOME_TEXT = `# Welcome to Markdown Editor

A small, **local** Markdown reader & writer — styled after *TextEdit*, with a little more ~~plastic~~ leather and brushed aluminium.

## Getting started

- **Open** a \`.md\` file with the folder button, ⌘O, or just *drag it onto this window*.
- **Write** on the left, see the result on the right. Switch views with the segmented control (or ⌘\\\\).
- **Save** with ⌘S. In Chrome or Edge it writes straight back to the file.

## Formatting cheatsheet

| You type            | You get             |
| :------------------ | :------------------ |
| \`**bold**\`          | **bold**            |
| \`*italic*\`          | *italic*            |
| \`~~strike~~\`        | ~~strike~~          |
| \`\` \`code\` \`\`        | \`code\`              |
| \`[link](https://…)\` | [link](https://commonmark.org) |

### Lists keep going by themselves

1. Press **Enter** at the end of an item to continue the list.
2. Press **Enter** on an empty item to finish it.
3. **Tab** nests an item, **⇧Tab** brings it back.
   - Like this one.

- [x] Read the welcome note
- [ ] Open your own file

> “Simplicity is prerequisite for reliability.”
> — Edsger W. Dijkstra

\`\`\`js
// Code blocks are shown verbatim.
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

---

Jump back to the [top](#welcome-to-markdown-editor).
`;
