import { Enum } from '@fromcode119/reactor';

/** Frontend system-gate health state. */
export class SystemStatus extends Enum {
  static readonly LOADING = new SystemStatus('LOADING');
  static readonly OK = new SystemStatus('OK');
  static readonly MAINTENANCE = new SystemStatus('MAINTENANCE');

  private constructor(value: string) {
    super(value);
  }
}
