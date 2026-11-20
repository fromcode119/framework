import type { PendingSave } from '@/lib/settings/pending-save';

/**
 * Every part of one settings page that has something unsaved, so the page saves with ONE bar.
 *
 * A page built from independent cards used to give each card a Save of its own: change two numbers in
 * two cards and there were two buttons to find, and nothing said which of them had been pressed. The
 * cards still own their values and their writes; they only tell this registry when they differ from
 * what was read, and the page's bar saves the ones that do.
 */
export class PendingSaves {
  private static readonly parts = new Set<PendingSave>();
  private static readonly listeners = new Set<() => void>();

  static add(part: PendingSave): void {
    PendingSaves.parts.add(part);
    PendingSaves.changed();
  }

  static remove(part: PendingSave): void {
    PendingSaves.parts.delete(part);
    PendingSaves.changed();
  }

  static subscribe(listener: () => void): () => void {
    PendingSaves.listeners.add(listener);
    return () => { PendingSaves.listeners.delete(listener); };
  }

  /** Told by a part whenever its values may have changed. */
  static changed(): void {
    PendingSaves.listeners.forEach((listener) => listener());
  }

  static anyDirty(): boolean {
    return [...PendingSaves.parts].some((part) => part.dirty);
  }

  /** Saves every part that differs from what was read, one after another; a part that fails stays unsaved. */
  static async saveAll(): Promise<void> {
    for (const part of [...PendingSaves.parts]) {
      if (part.dirty) await part.save();
    }
    PendingSaves.changed();
  }

  static discardAll(): void {
    PendingSaves.parts.forEach((part) => { if (part.dirty) part.discard(); });
    PendingSaves.changed();
  }
}
