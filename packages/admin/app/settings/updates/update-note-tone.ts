/** The tone an update panel gives its status line, as the note under the row draws it. */
export class UpdateNoteTone {
  private static readonly BY_TONE: Record<string, 'info' | 'error' | 'warning' | 'success'> = {
    danger: 'error',
    warning: 'warning',
    success: 'success',
  };

  static of(tone: string): 'info' | 'error' | 'warning' | 'success' {
    return UpdateNoteTone.BY_TONE[tone] ?? 'info';
  }
}
