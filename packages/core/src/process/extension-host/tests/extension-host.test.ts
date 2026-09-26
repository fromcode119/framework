import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { ExtensionHostSocket } from '@core/process/extension-host/extension-host-socket';
import { PrivilegedSpawner } from '@core/process/privileged-spawner';
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

describe('PrivilegedSpawner when its api goes away', () => {
  afterEach(() => vi.restoreAllMocks());

  it("in extension-host, stops that api's processes and keeps serving the others", () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const port = new PortFixture();
    const spawner: any = new PrivilegedSpawner(port as any, '/tmp/fc-runtime', false);
    const killed: string[] = [];
    spawner.children.set('plugin-a.host1.1', { kill: () => killed.push('plugin-a.host1.1') });
    port.disconnect();
    expect(killed).toEqual(['plugin-a.host1.1']);
    expect(exit).not.toHaveBeenCalled();
  });

  it("as the api's own child, still exits with it", () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const port = new PortFixture();
    void new PrivilegedSpawner(port as any, '/tmp/fc-runtime');
    port.disconnect();
    expect(exit).toHaveBeenCalledWith(0);
  });
});
