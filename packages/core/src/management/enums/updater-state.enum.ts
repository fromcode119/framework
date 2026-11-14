import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where a platform self-update is. `FAILED` means nothing was changed; `ROLLED_BACK` means the new version
 * was started, did not report itself healthy, and the previous one is serving again. `HELD` means nothing
 * was changed either: the deploy mode is rolling, rolling was not possible this time, and the update waits
 * for a retry or for an operator's "Update with restart" instead of taking the sites down on its own.
 */
export class UpdaterState extends Enum {
  static readonly IDLE = new UpdaterState('idle');
  static readonly UPDATING = new UpdaterState('updating');
  static readonly SUCCEEDED = new UpdaterState('succeeded');
  static readonly FAILED = new UpdaterState('failed');
  static readonly ROLLED_BACK = new UpdaterState('rolledBack');
  static readonly HELD = new UpdaterState('held');

  private constructor(value: string) {
    super(value);
  }
}
