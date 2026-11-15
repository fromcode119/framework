import { NavUtils } from '@/lib/nav-utils';

/**
 * A key for every section of the menu, so the console is walked without the mouse: press G, then that
 * key. An operator who spends the day here should not have to aim at a nine-row list to change screen.
 *
 * The key is a LATIN letter taken from the section's own address (`/orders/open` gives `o`), never
 * from its name: the console speaks the operator's language, and the keyboard under their hands may be
 * laid out in another one. For the same reason the sequence is read from `event.code` — the physical
 * key — so `G` then `O` works on a Cyrillic layout exactly as it does on a Latin one.
 *
 * The assignment is DERIVED and shown, never stored: the first free letter of each address, in menu
 * order, so two sections never answer to one key and the letters do not drift between sessions. Every
 * row prints the key it answers to, so nothing here is a secret the operator has to be told.
 */
export class NavShortcuts {
  /** The key that opens the sequence. */
  static readonly LEADER = 'KeyG';

  /** How long the console waits for the second key before forgetting that G was pressed. */
  static readonly WINDOW_MS = 1500;

  /**
   * The word a section's letter is taken from: the first part of its address, which is the plugin or
   * the console's own area and does not change when a page is renamed. `/` is the dashboard.
   */
  private static word(path: string): string {
    const first = String(path || '').split(/[?#]/)[0].split('/').filter(Boolean)[0] || 'dashboard';
    return first.toLowerCase().replace(/[^a-z]/g, '');
  }

  /**
   * One letter per row, in menu order: the first letter of its address that nothing above it took.
   * A row whose address offers no free letter gets none rather than stealing one.
   */
  static assign(rows: Array<{ path?: string }>): Map<string, string> {
    const taken = new Set<string>();
    const assigned = new Map<string, string>();
    for (const row of rows) {
      const path = NavUtils.normalizePath(row?.path);
      if (!path || assigned.has(path)) continue;
      const letter = [...NavShortcuts.word(row?.path || '')].find((character) => !taken.has(character));
      if (!letter) continue;
      taken.add(letter);
      assigned.set(path, letter);
    }
    return assigned;
  }

  /** The address the second key opens, or nothing when no section answers to it. */
  static pathFor(assigned: Map<string, string>, code: string): string {
    const letter = NavShortcuts.letterOf(code);
    if (!letter) return '';
    for (const [path, candidate] of assigned) if (candidate === letter) return path;
    return '';
  }

  /** `KeyE` is the physical key that prints `e` on a Latin layout. */
  static letterOf(code: string): string {
    const match = /^Key([A-Z])$/.exec(String(code || ''));
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Whether a key press belongs to the page rather than to the menu: anything typed into a field, and
   * anything held together with a modifier, is the operator's, not a shortcut.
   */
  static isTyping(target: EventTarget | null, event: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): boolean {
    if (event?.metaKey || event?.ctrlKey || event?.altKey) return true;
    const element = target as HTMLElement | null;
    if (!element || typeof element.closest !== 'function') return false;
    return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }
}
