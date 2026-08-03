import { Enum } from '@fromcode119/reactor';

/** Platform measurement system (admin Settings → Localization). */
export class MeasurementSystem extends Enum {
  static readonly METRIC = new MeasurementSystem('metric');
  static readonly IMPERIAL = new MeasurementSystem('imperial');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a stored setting string to a member; defaults to METRIC. */
  static resolve(value: unknown): MeasurementSystem {
    if (value instanceof MeasurementSystem) return value;
    const found = MeasurementSystem.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as MeasurementSystem | undefined) ?? MeasurementSystem.METRIC;
  }
}
