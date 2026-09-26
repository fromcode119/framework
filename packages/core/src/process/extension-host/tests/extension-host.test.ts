import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
import { SpawnerGuests } from '@core/process/spawner-guests';
import { MessagePortEvent } from '@core/process/enums/message-port-event.enum';

describe('ExtensionHostSocket.groupId', () => {
  it("finds the api user's group — the only group allowed to connect", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-group-')), 'group');
    fs.writeFileSync(file, 'root:x:0:\nnode:x:1000:\nplugin:x:20001:\n');
    expect(ExtensionHostSocket.groupId('node', file)).toBe(1000);
    expect(() => ExtensionHostSocket.groupId('nobody-here', file)).toThrow('no group "nobody-here"');
  });
});

/** A message port the test can disconnect, as an api going away would. */
class PortFixture extends EventEmitter {
  send(): void {}
  close(): void {}
  disconnect(): void { this.emit(MessagePortEvent.DISCONNECT); }
}

/** A child process stand-in: records the signals it is sent. */
class ChildFixture {
  readonly killed: string[] = [];
  exitCode: number | null = null;
  constructor(readonly pid: number) {}
  kill(signal: string): void { this.killed.push(signal); }
}

describe('PrivilegedSpawner when its api goes away', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('in extension-host, keeps a process another api took over, and stops one nobody holds after the grace', () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const guests = new SpawnerGuests<PrivilegedSpawner>(1_000);
    const oldApi = new PortFixture();
    const newApi = new PortFixture();
    const before = new PrivilegedSpawner(oldApi as any, '/tmp/fc-runtime', false, guests);
    const after = new PrivilegedSpawner(newApi as any, '/tmp/fc-runtime', false, guests);
    const takenOver = new ChildFixture(101);
    const leftBehind = new ChildFixture(102);
    guests.add('plugin-a.old.1', takenOver as any, before, null);
    guests.add('plugin-b.old.1', leftBehind as any, before, null);
    guests.claim('plugin-a.old.1', after);

    oldApi.disconnect();
    expect(takenOver.killed).toEqual([]);
    expect(leftBehind.killed).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(takenOver.killed).toEqual([]);
    expect(leftBehind.killed).toEqual(['SIGKILL']);
    expect(exit).not.toHaveBeenCalled();
  });

  it("as the api's own child, stops its processes and exits with it", () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const port = new PortFixture();
    const spawner = new PrivilegedSpawner(port as any, '/tmp/fc-runtime');
    const child = new ChildFixture(201);
    (spawner as any).guests.add('plugin-a.api.1', child, spawner, null);
    port.disconnect();
    expect(child.killed).toEqual(['SIGKILL']);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('SpawnerGuests', () => {
  it('lists what each process was labelled with, and how many apis hold it', () => {
    const guests = new SpawnerGuests<string>(0);
    const label = { slug: 'alpha', version: '1.2.0', memoryMb: 256, attachSecret: 's' };
    guests.add('plugin-alpha.h.1', new ChildFixture(7) as any, 'api-1', label);
    guests.claim('plugin-alpha.h.1', 'api-2');
    expect(guests.inventory()).toEqual([{ id: 'plugin-alpha.h.1', pid: 7, label, holders: 2 }]);
    expect(guests.holders('plugin-alpha.h.1')).toEqual(['api-1', 'api-2']);
  });

  it('refuses to hand over a process it does not run', () => {
    expect(() => new SpawnerGuests<string>(0).claim('plugin-x.h.1', 'api-1')).toThrow('no running process');
  });

  it('a claim made during the grace saves the process', () => {
    vi.useFakeTimers();
    const guests = new SpawnerGuests<string>(1_000);
    const child = new ChildFixture(9);
    guests.add('plugin-alpha.h.1', child as any, 'old', null);
    guests.release('old');
    vi.advanceTimersByTime(500);
    guests.claim('plugin-alpha.h.1', 'new');
    vi.advanceTimersByTime(1_000);
    expect(child.killed).toEqual([]);
    vi.useRealTimers();
  });
});
