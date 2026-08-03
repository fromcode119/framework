import { Enum } from '@fromcode119/reactor';

/** Outcome of resolving a layout. */
export class LayoutResolutionStatus extends Enum {
  static readonly RESOLVED = new LayoutResolutionStatus('resolved');
  static readonly DISABLED = new LayoutResolutionStatus('disabled');
  static readonly MISSING = new LayoutResolutionStatus('missing');

  private constructor(value: string) {
    super(value);
  }
}
