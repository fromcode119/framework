import { Enum } from '@fromcode119/react-class-components/lang';

/** Whether a provider is being told an incident just started or just ended. */
export class MonitoringChange extends Enum {
  static readonly OPENED = new MonitoringChange('opened');
  static readonly RESOLVED = new MonitoringChange('resolved');

  private constructor(value: string) {
    super(value);
  }
}
