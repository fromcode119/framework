import type { IMessagePort } from '@core/process/interfaces/message-port.interface';
import type { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import type { SpawnerClient } from '@core/process/spawner-client';

/** A running guest, however it was started. */
export interface IGuestProcess {
  readonly pid: number | null;
  /** The channel to the guest: IPC for a forked child, a framed Unix socket for a spawned one. */
  readonly port: IMessagePort;
  /**
   * A directory the guest owns and the launching process can reach — where the guest puts a socket of
   * its own (an isolated plugin's route server). Unreadable by every other guest when identities are in
   * force.
   */
  readonly socketDir: string;
  /** `0o600` when guest and host are the same user, `0o666` when they are not (the directory guards it). */
  readonly socketMode: number;
  /** The spawner that started it — which `extension-host` it runs in — or null for the api's own child. */
  readonly launcher: SpawnerClient | null;
  kill(signal?: NodeJS.Signals): void;
  onExit(listener: (code: number | null, signal: string | null) => void): void;
  onOutput(listener: (stream: GuestOutputStream, line: string) => void): void;
}
