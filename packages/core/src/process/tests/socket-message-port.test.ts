import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { SocketMessagePort } from '@core/process/socket-message-port';

describe('SocketMessagePort', () => {
  it('carries structured-clone messages both ways and closes when the peer goes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-port-'));
    const socketPath = path.join(dir, 'channel.sock');
    const accepting = SocketMessagePort.listenOnce(socketPath, 0o600, 2_000);
    const guestPort = await SocketMessagePort.connect(socketPath, 2_000);
    const hostPort = await accepting;

    const host = new PluginChannel(hostPort);
    const guest = new PluginChannel(guestPort);
    guest.serve(async (type, payload) => ({ echoed: type, at: payload.when, bytes: payload.blob }));
    const reply = await host.request<{ echoed: string; at: Date; bytes: Buffer }>('probe', { when: new Date(0), blob: Buffer.from('ok') }, 2_000);
    expect(reply.echoed).toBe('probe');
    expect(reply.at).toBeInstanceOf(Date);
    expect(Buffer.from(reply.bytes).toString()).toBe('ok');

    // One connection only: the listener is gone once the guest connected.
    await expect(SocketMessagePort.connect(socketPath, 300)).rejects.toBeTruthy();

    const closed = new Promise<void>((resolve) => hostPort.on('disconnect', () => resolve()));
    guestPort.close();
    await closed;
    expect(hostPort.isClosed).toBe(true);
    await expect(host.request('anything', {}, 200)).rejects.toThrow(/closed|disconnected/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reassembles a message that arrives in many chunks', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-port-'));
    const socketPath = path.join(dir, 'channel.sock');
    const accepting = SocketMessagePort.listenOnce(socketPath, 0o600, 2_000);
    const guestPort = await SocketMessagePort.connect(socketPath, 2_000);
    const hostPort = await accepting;
    const received = new Promise<any>((resolve) => hostPort.on('message', resolve));
    const big = { text: 'x'.repeat(2 * 1024 * 1024), list: Array.from({ length: 1000 }, (_, i) => i) };
    guestPort.send(big);
    const message = await received;
    expect(message.text.length).toBe(big.text.length);
    expect(message.list[999]).toBe(999);
    guestPort.close();
    hostPort.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
