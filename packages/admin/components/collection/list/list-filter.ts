/**
 * One filter of a collection list: what it is called, the values it offers, the one in force, and how
 * to change it. The status filter, each select field's filter and the archived view are all one of
 * these, so the panel and the chips treat them alike.
 */
export class ListFilter {
  constructor(
    readonly key: string,
    readonly label: string,
    /** Every value it can take, the "no filter" one first. */
    readonly options: readonly { label: string; value: string }[],
    readonly value: string,
    /** The value that means "not filtered" — `all`, or the active records of an archivable list. */
    readonly defaultValue: string,
    readonly apply: (value: string) => void,
  ) {}

  get isActive(): boolean {
    return this.value !== this.defaultValue;
  }

  /** The chosen option's words, for the chip that shows it. */
  get valueLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label || this.value;
  }

  reset(): void {
    this.apply(this.defaultValue);
  }
}
