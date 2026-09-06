import { SpawnerClient } from '@core/process/spawner-client';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/**
 * A guest the privileged spawner started as another user: not our child, so exit and output arrive
 * as notifications from the spawner and `kill` is a request to it. The channel is the socket the guest
 * connected back to us on.
 */
export class SpawnedGuestProcess implements IGuestProcess {
  readonly socketMode = 0o666;

  constructor(
    private readonly spawner: SpawnerClient,
    private readonly id: string,
    readonly pid: number,
    readonly port: IMessagePort,
    readonly socketDir: string,
  ) {}

  kill(signal: NodeJS.Signals = 'SIGKILL'): void {
    this.spawner.kill(this.id, signal);
  }

  onExit(listener: (code: number | null, signal: string | null) => void): void {
    // Only THIS process's exit: a predecessor with the same id may still be reported after the swap.
    this.spawner.onExit(this.id, (code, signal, pid) => { if (pid === null || pid === this.pid) listener(code, signal); });
  }

  onOutput(listener: (stream: 'stdout' | 'stderr', line: string) => void): void {
    this.spawner.onOutput(this.id, listener);
  }
}
