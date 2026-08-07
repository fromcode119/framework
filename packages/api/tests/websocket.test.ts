import { WebSocketManager } from '@fromcode119/core';
import { HookManager } from '@fromcode119/core';
import { WebSocket } from 'ws';
import * as http from 'http';

/**
 * Promise-based, NOT `done`-callback based.
 *
 * This suite was written for jest's `done` callback, which vitest does not have: vitest passes a
 * `TestContext` as the first argument, so `done` was an OBJECT. `beforeAll` therefore returned
 * immediately instead of waiting for `server.listen`, `port` was still `undefined` when the tests ran,
 * and all three died on `SyntaxError: Invalid URL: ws://localhost:undefined`. The `done()` call inside
 * the listen callback was itself a TypeError nobody ever saw, because it fired after the hook resolved.
 *
 * Awaiting a real promise makes the listening port genuinely available — the suite now connects to the
 * server's actual ephemeral port.
 */
describe('web-socket-manager', () => {
  let manager: WebSocketManager;
  let hooks: HookManager;
  let server: http.Server;
  let port: number;

  /** Resolves with the first message of `type` the socket receives, then closes it. */
  const awaitMessage = (ws: WebSocket, type: string, onOpen?: () => void): Promise<any> =>
    new Promise((resolve, reject) => {
      ws.on('error', reject);
      ws.on('open', () => onOpen?.());
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type !== type) return;
        ws.on('close', () => resolve(msg));
        ws.close();
      });
    });

  beforeAll(async () => {
    hooks = new HookManager();
    manager = new WebSocketManager(hooks);
    server = http.createServer();
    const wss = manager.initialize(server);

    server.on('upgrade', (request, socket, head) => {
      if (wss) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    manager.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('allows client connection and receives greeting', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const msg = await awaitMessage(ws, 'system:ready');

    expect(msg.type).toBe('system:ready');
  });

  it('broadcasts messages to all clients', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const msg = await awaitMessage(ws, 'test:event', () => manager.broadcast('test:event', { foo: 'bar' }));

    expect(msg.payload.foo).toBe('bar');
  });

  it('broadcasts collection events automatically', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const msg = await awaitMessage(ws, 'collection:posts:created', () =>
      hooks.emit('collection:posts:afterCreate', { id: 1, title: 'Test' }),
    );

    expect(msg.payload.title).toBe('Test');
  });
});
