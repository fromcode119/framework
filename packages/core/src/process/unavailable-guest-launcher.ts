import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';

/**
 * The api was told to start plugin processes in the `extension-host` container and could not reach it.
 * Every launch fails with that reason — a plugin shows WHY it is not running — rather than quietly
 * starting the process somewhere the operator did not choose.
 */
export class UnavailableGuestLauncher extends GuestProcessLauncher {
  readonly isolatesIdentity = true;

  constructor(private readonly reason: string) {
    super();
  }

  async launch(spec: IGuestProcessSpec): Promise<IGuestProcess> {
    throw new Error(`cannot start "${spec.id}": ${this.reason}`);
  }
}
