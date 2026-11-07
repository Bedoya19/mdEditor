/**
 * @file keymap.js
 * The ONE place where keyboard shortcuts are defined.
 * Tooltips read from here too, so a shortcut and its label can't disagree.
 *
 * "mod" = ⌘ on macOS, Ctrl on Windows/Linux.
 * Heading shortcuts (⌥⌘0…4) follow Google Docs' convention; list shortcuts
 * (⇧⌘7/8/9) follow GitHub's and Notion's.
 */
export const KEYMAP = {
  'mod+n': 'file.new',          // the browser reserves ⌘N; works in the desktop build
  'mod+o': 'file.open',
  'mod+s': 'file.save',
  'mod+shift+s': 'file.saveAs',

  'mod+b': 'format.bold',
  'mod+i': 'format.italic',
  'mod+shift+x': 'format.strikethrough',
  'mod+e': 'format.code',
  'mod+k': 'format.link',
  'mod+shift+8': 'format.bulletList',
  'mod+shift+7': 'format.orderedList',
  'mod+shift+9': 'format.taskList',

  'alt+mod+0': 'format.body',
  'alt+mod+1': 'format.heading1',
  'alt+mod+2': 'format.heading2',
  'alt+mod+3': 'format.heading3',
  'alt+mod+4': 'format.heading4',

  'alt+mod+t': 'table.format',

  'mod+\\': 'view.cycle',
};
