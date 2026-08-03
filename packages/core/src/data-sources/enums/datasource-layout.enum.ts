import { Enum } from '@fromcode119/reactor';

/** How a datasource renders its records. */
export class DatasourceLayout extends Enum {
  static readonly CARDS = new DatasourceLayout('cards');
  static readonly LIST = new DatasourceLayout('list');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to CARDS. */
  static resolve(value: unknown): DatasourceLayout {
    if (value instanceof DatasourceLayout) return value;
    const found = DatasourceLayout.fromValue(String(value ?? '').trim());
    return (found as DatasourceLayout | undefined) ?? DatasourceLayout.CARDS;
  }
}
