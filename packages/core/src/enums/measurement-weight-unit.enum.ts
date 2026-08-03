import { Enum } from '@fromcode119/reactor';

/** Weight unit implied by the platform measurement system. */
export class MeasurementWeightUnit extends Enum {
  static readonly KG = new MeasurementWeightUnit('kg');
  static readonly LB = new MeasurementWeightUnit('lb');

  private constructor(value: string) {
    super(value);
  }
}
