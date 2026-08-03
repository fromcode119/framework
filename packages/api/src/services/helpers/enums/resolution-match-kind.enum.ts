import { Enum } from '@fromcode119/reactor';

/** How a content record matched during resolution. */
export class ResolutionMatchKind extends Enum {
  static readonly CUSTOM = new ResolutionMatchKind('custom');
  static readonly SLUG = new ResolutionMatchKind('slug');

  private constructor(value: string) {
    super(value);
  }
}
