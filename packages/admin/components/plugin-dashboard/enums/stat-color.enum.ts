import { Enum } from '@fromcode119/reactor';

/** Accent colour of a plugin-dashboard stat row. */
export class StatColor extends Enum {
  static readonly PRIMARY = new StatColor('primary');
  static readonly SUCCESS = new StatColor('success');
  static readonly WARNING = new StatColor('warning');
  static readonly DANGER = new StatColor('danger');
  static readonly INFO = new StatColor('info');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw value to a member; anything unrecognised is PRIMARY.
   *
   * Plugins populate `IStatItem.color` from their own bundles, where nothing type-checks it — they pass
   * the raw string `'primary'`. `('primary').value` is `undefined`, so the class lookup missed and the
   * dashboard crashed with "Cannot read properties of undefined (reading 'bg')". Every Enum the
   * framework accepts across a plugin boundary needs this.
   */
  static resolve(value: unknown): StatColor {
    if (value instanceof StatColor) return value;
    const found = StatColor.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as StatColor | undefined) ?? StatColor.PRIMARY;
  }
}
