import { IpcMessagePort } from '@core/process/ipc-message-port';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { ProcessEntry } from '@core/process/process-entry';

/**
 * Entry of the privileged spawner. Forked by `PrivilegeDrop` while the app is still root, with an
 * IPC channel and an empty environment; the runtime directory comes as its one argument.
 */
@ProcessEntry.start('privileged-spawner')
export class PrivilegedSpawnerMain {
  static main(argv: string[]): void {
    if (typeof process.send !== 'function') throw new Error('must be forked with an IPC channel');
    const runtimeDir = argv[0];
    if (!runtimeDir) throw new Error('runtime directory argument missing');
    const spawner = new PrivilegedSpawner(new IpcMessagePort(process), runtimeDir);
    void spawner;
    process.on('disconnect', () => process.exit(0));
  }
}
