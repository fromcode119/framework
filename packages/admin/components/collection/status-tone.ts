/**
 * The colour a record's state is drawn in, wherever it is drawn: the list cell, the record's card, the
 * header badge and the dots of its ⋯ menu. The option's own `tone` decides; a `status` option that names
 * none falls back to the long-standing reading of a few common words, the same in every place, so a draft
 * is never amber in the list and grey in its own header.
 */
export class StatusTone {
  private static readonly WORDS: Record<string, string> = {
    published: 'success',
    read: 'success',
    draft: 'warning',
    unread: 'warning',
    new: 'warning',
    archived: 'danger',
  };

  /** The tone the field's option declares for this value, or ''. */
  static declared(field: any, value: unknown): string {
    const wanted = String(value ?? '').trim();
    if (!wanted || !Array.isArray(field?.options)) return '';
    const option = field.options.find((candidate: any) => String(candidate?.value ?? '').trim() === wanted);
    return option && typeof option === 'object' ? String(option.tone ?? '').trim() : '';
  }

  /** The tone of a status value with no declared tone: 'default' when the word means nothing here. */
  static ofWord(value: unknown): string {
    return StatusTone.WORDS[String(value ?? '').trim().toLowerCase()] ?? 'default';
  }

  /** The declared tone, else the word's. */
  static of(field: any, value: unknown): string {
    return StatusTone.declared(field, value) || StatusTone.ofWord(value);
  }
}
