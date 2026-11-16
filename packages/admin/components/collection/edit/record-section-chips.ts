/**
 * Whether a value is a handful of short labels — sizes, tags, categories, locales — and so reads as
 * chips rather than as a line of commas or as a one-column table.
 *
 * The console already decides HOW to read a value from its shape: a long structure becomes the table it
 * draws for any recorded value. The short list fell between the two and came out as prose, so "S, M, L,
 * XL" read as a sentence about the product instead of as four things it comes in. Every record page
 * worth copying draws this one the same way, and so does our own list view's tag column.
 *
 * The limits are what keeps it honest: above either of them the value is not a handful of labels any
 * more, and the table says more about it than a row of chips would.
 */
export class RecordSectionChips {
  /** More entries than the eye takes in at a glance; past this the table is the better reading. */
  static readonly MAX_ENTRIES = 12;

  /** Longer than a label; past this the entries stop lining up and the chips read as broken sentences. */
  static readonly MAX_TEXT = 24;

  /** The labels to draw, or `null` when the value is anything other than a handful of short scalars. */
  static of(raw: unknown): string[] | null {
    if (!Array.isArray(raw) || !raw.length || raw.length > RecordSectionChips.MAX_ENTRIES) return null;
    const chips: string[] = [];
    for (const entry of raw) {
      if (entry === null || typeof entry === 'undefined' || typeof entry === 'object') return null;
      const text = String(entry).trim();
      if (!text || text.length > RecordSectionChips.MAX_TEXT) return null;
      chips.push(text);
    }
    return chips;
  }
}
