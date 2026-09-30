import { describe, expect, it } from 'vitest';
import { SpawnerClient } from '@core/process/spawner-client';
import { SpawnedGuestProcess } from '@core/process/spawned-guest-process';
import { SpawnerMessage } from '@core/process/enums/spawner-message.enum';

/** A guest the spawner stopped for breaking a limit exits with WHY, so its api can record the reason. */
describe('a guest stopped on purpose', () => {
  it('carries the reason from the spawner to whoever waits for its exit', () => {
    const client = Object.create(SpawnerClient.prototype) as SpawnerClient;
    Object.assign(client, { exitListeners: new Map(), outputListeners: new Map() });
    const guest = new SpawnedGuestProcess(client, 'plugin-hello-site.1', 4321, {} as any, '/tmp');
    const exits: unknown[] = [];
    guest.onExit((code, signal, reason) => exits.push({ code, signal, reason }));

    (client as any).notified(String(SpawnerMessage.EXIT.value), { id: 'plugin-hello-site.1', pid: 4321, code: null, signal: 'SIGKILL', reason: 'used 60 MB of memory; the limit for this plugin is 50 MB' });
    (client as any).notified(String(SpawnerMessage.EXIT.value), { id: 'plugin-hello-site.1', pid: 4321, code: 1, signal: null });

    expect(exits).toEqual([
      { code: null, signal: 'SIGKILL', reason: 'used 60 MB of memory; the limit for this plugin is 50 MB' },
      { code: 1, signal: null, reason: null },
    ]);
  });
});
