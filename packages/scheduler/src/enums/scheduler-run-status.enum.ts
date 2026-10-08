import { Enum } from '@fromcode119/react-class-components/lang';

/** Where one run of a background job stands. */
export class SchedulerRunStatus extends Enum {
  static readonly RUNNING = new SchedulerRunStatus('running');
  static readonly SUCCEEDED = new SchedulerRunStatus('succeeded');
  static readonly FAILED = new SchedulerRunStatus('failed');

  private constructor(value: string) {
    super(value);
  }
}
