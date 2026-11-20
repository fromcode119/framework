import type { Hint } from '@/components/ui/view/hint.client';

/** The tone an update panel gives its status line, as the note under the row draws it. */
export class UpdateNoteTone {
  private static readonly BY_TONE: Record<string, Hint['variant']> = {
    danger: 'error',
    warning: 'warning',
    success: 'success',
  };

  static of(tone: string): Hint['variant'] {
    return UpdateNoteTone.BY_TONE[tone] ?? 'info';
  }
}
