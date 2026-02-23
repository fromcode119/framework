import { WebSocketManager } from '@fromcode119/core';
import { HookManager } from '@fromcode119/core';
import { WebSocket } from 'ws';
import * as http from 'http';

describe('web-socket-manager', () => {
  let manager: WebSocketManager;
  let hooks: HookManager;
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    hooks = new HookManager();
    manager = new WebSocketManager(hooks);
    server = http.createServer();
    const wss = manager.initialize(server);

    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    server.listen(0, () => {
      port = (server.address() as any).port;
      done();
    });
  });

  afterAll((done) => {
    manager.close();
    server.close(done);
  });

  it('allows client connection and receives greeting', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on('open', () => {
      // Connection successful
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'system:ready') {
        ws.on('close', () => done());
        ws.close();
      }
    });
  });

  it('broadcasts messages to all clients', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    
    ws.on('open', () => {
      manager.broadcast('test:event', { foo: 'bar' });
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'test:event') {
        expect(msg.payload.foo).toBe('bar');
        ws.on('close', () => done());
        ws.close();
      }
    });
  });

  it('broadcasts collection events automatically', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    
    ws.on('open', () => {
      hooks.emit('collection:posts:afterCreate', { id: 1, title: 'Test' });
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'collection:posts:created') {
        expect(msg.payload.title).toBe('Test');
        ws.on('close', () => done());
        ws.close();
      }
    });
  });
});
