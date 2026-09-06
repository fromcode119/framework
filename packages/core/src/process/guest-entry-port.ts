import { IpcMessagePort } from '@core/process/ipc-message-port';
import { SocketMessagePort } from '@core/process/socket-message-port';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';

/**
 * How a guest process finds its host, decided by how it was started.
 *
 * Forked directly (development, or a deployment without the privileged spawner): the IPC channel is
 * there and `process.send` exists. Started by the spawner as another user: no IPC — the host's socket
 * path came on the command line, and the guest connects to it. The path is not a secret (any user can
 * read `/proc/<pid>/cmdline`); the directory it sits in is what only this guest's user can traverse.
 */
export class GuestEntryPort {
  static readonly HOST_SOCKET_FLAG = '--fc-host-socket';
  private static readonly CONNECT_TIMEOUT_MS = 10_000;

  static async connect(argv: string[] = process.argv): Promise<IMessagePort> {
    const index = argv.indexOf(GuestEntryPort.HOST_SOCKET_FLAG);
    if (index >= 0 && argv[index + 1]) {
      return SocketMessagePort.connect(argv[index + 1], GuestEntryPort.CONNECT_TIMEOUT_MS);
    }
    if (typeof process.send !== 'function') {
      throw new Error(`guest: must be forked with an IPC channel or given ${GuestEntryPort.HOST_SOCKET_FLAG} <path>`);
    }
    return new IpcMessagePort(process);
  }

  /** Whether this process was handed a host socket, i.e. runs as a different user than its host. */
  static isSocketMode(argv: string[] = process.argv): boolean {
    return argv.includes(GuestEntryPort.HOST_SOCKET_FLAG);
  }
}
