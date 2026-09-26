import { Enum } from '@fromcode119/react-class-components/lang';

/** Outcome of resolving a layout. */
export class LayoutResolutionStatus extends Enum {
  static readonly RESOLVED = new LayoutResolutionStatus('resolved');
  static readonly DISABLED = new LayoutResolutionStatus('disabled');
  static readonly MISSING = new LayoutResolutionStatus('missing');

  private constructor(value: string) {
    super(value);
  }
}
