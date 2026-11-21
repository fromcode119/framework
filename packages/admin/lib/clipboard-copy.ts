import { Platform } from '@fromcode119/react-class-components';

/**
 * Writes text to the clipboard and says whether it worked. The browser refuses the write when the page
 * is not focused or the permission is denied; a copy button then says "Copy failed" instead of throwing.
 */
export class ClipboardCopy {
  static readonly COPIED = 'copied';
  static readonly FAILED = 'failed';
  static readonly SHOWN_MS = 1500;

  static async write(text: string): Promise<string> {
    if (!Platform.isBrowser) return ClipboardCopy.FAILED;
    try {
      await navigator.clipboard.writeText(text);
      return ClipboardCopy.COPIED;
    } catch {
      return ClipboardCopy.FAILED;
    }
  }

  /** The label a copy button shows for its current state. */
  static labelKey(state: string): string {
    if (state === ClipboardCopy.COPIED) return 'collection.edit.copied';
    if (state === ClipboardCopy.FAILED) return 'collection.edit.copyFailed';
    return 'collection.edit.copyTitle';
  }
}
