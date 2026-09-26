import { Enum } from '@fromcode119/react-class-components/lang';

/** Length unit implied by the platform measurement system. */
export class MeasurementLengthUnit extends Enum {
  static readonly CM = new MeasurementLengthUnit('cm');
  static readonly IN = new MeasurementLengthUnit('in');

  private constructor(value: string) {
    super(value);
  }
}
