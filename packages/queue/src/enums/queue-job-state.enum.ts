import { Enum } from '@fromcode119/react-class-components/lang';

/** Where a job in the queue stands: waiting its turn, waiting for its time, running, or failed. */
export class QueueJobState extends Enum {
  static readonly WAITING = new QueueJobState('waiting');
  static readonly DELAYED = new QueueJobState('delayed');
  static readonly ACTIVE = new QueueJobState('active');
  static readonly FAILED = new QueueJobState('failed');

  private constructor(value: string) {
    super(value);
  }
}
