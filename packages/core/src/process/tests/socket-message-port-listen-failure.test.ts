import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocketMessagePort } from '@core/process/socket-message-port';

describe('SocketMessagePort.listenOnce', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects when the socket cannot be given its mode — it does not throw where nobody can catch it', async () => {
    const socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-sock-')), 'channel.sock');
    vi.spyOn(fs, 'chmodSync').mockImplementation(() => { throw Object.assign(new Error('EPERM: operation not permitted, chmod'), { code: 'EPERM' }); });
    await expect(SocketMessagePort.listenOnce(socketPath, 0o660, 2_000)).rejects.toThrow('EPERM');
  });
});
