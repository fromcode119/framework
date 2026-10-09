/** One field of the quick edit form under a row: the field as it is drawn, and how wide it sits. */
export class QuickEditField {
  constructor(
    /** The field definition handed to the field renderer, with its declared control applied. */
    readonly field: any,
    /** Grid columns it spans, 1–4. */
    readonly span: number,
  ) {}

  get name(): string {
    return String(this.field.name);
  }

  /**
   * The grid class for its span. Spelled out in full because Tailwind only generates classes it can
   * read in the source — a class assembled from the number would never reach the stylesheet.
   */
  get spanClass(): string {
    if (this.span >= 4) return 'sm:col-span-2 lg:col-span-4';
    if (this.span === 3) return 'sm:col-span-2 lg:col-span-3';
    if (this.span === 2) return 'sm:col-span-2';
    return '';
  }
}
