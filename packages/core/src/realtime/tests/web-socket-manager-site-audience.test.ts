import http from 'http';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { WebSocketManager } from '@core/realtime/web-socket-manager';
import type { IRealtimeSocketBinding } from '@core/realtime/interfaces/realtime-socket-binding.interface';

/**
 * The live socket carries every collection write, whole rows included. Every connection used to join
 * one audience with nobody asked who they were, so an anonymous visitor on any site heard every
 * site's writes. A socket now hears only the site the api admitted it for.
 */
describe('who hears a live event', () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const close of closers.splice(0)) await close();
    TenantMode.reset();
  });

  /** A real server whose upgrade binds each connection to the site in its `?site=` (the api's authorizer stands here). */
  async function serve(hooks: HookManager): Promise<{ connect(site: string | null): Promise<{ ws: WebSocket; seen: string[]; closed: Promise<number> }> }> {
    const manager = new WebSocketManager(hooks);
    const server = http.createServer();
    const wss = manager.initialize(server)!;
    server.on('upgrade', (request, socket, head) => {
      const site = new URL(request.url || '', 'http://x').searchParams.get('site');
      const binding: IRealtimeSocketBinding | undefined = site === 'none' ? undefined : { tenantId: site };
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request, binding));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closers.push(async () => { manager.close(); await new Promise<void>((resolve) => server.close(() => resolve())); });
    const port = (server.address() as any).port;

    return {
      async connect(site) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/socket?site=${site ?? 'none'}`);
        const seen: string[] = [];
        const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
        ws.on('message', (data) => {
          const message = JSON.parse(String(data));
          if (message.type !== 'system:ready') seen.push(`${message.type}:${JSON.stringify(message.payload)}`);
        });
        await new Promise<void>((resolve) => { ws.on('open', () => resolve()); ws.on('close', () => resolve()); });
        return { ws, seen, closed };
      },
    };
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const onSite = (tenantId: string | undefined, fn: () => Promise<unknown>) => RequestContextUtils.storage.run({ tenantId } as any, fn);

  it('a write on one site reaches that site\'s sockets only; a write with no site reaches none', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const hooks = new HookManager();
    const server = await serve(hooks);
    const alpha = await server.connect('alpha');
    const beta = await server.connect('beta');

    await onSite('alpha', () => hooks.call('collection:customers:afterCreate', { email: 'a@alpha.test' }));
    await onSite(undefined, () => hooks.call('collection:customers:afterCreate', { email: 'nobody@none.test' }));
    await settle();

    expect(alpha.seen).toEqual(['collection:customers:created:{"email":"a@alpha.test"}']);
    expect(beta.seen).toEqual([]);
  });

  it('a connection nobody admitted is closed and hears nothing', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const hooks = new HookManager();
    const server = await serve(hooks);
    const stranger = await server.connect(null);

    await onSite('alpha', () => hooks.call('collection:customers:afterCreate', { email: 'a@alpha.test' }));

    expect(await stranger.closed).toBe(1008);
    expect(stranger.seen).toEqual([]);
  });

  it('without sites, every admitted socket hears every event', async () => {
    const hooks = new HookManager();
    const server = await serve(hooks);
    const only = await server.connect('');

    await hooks.call('collection:customers:afterCreate', { email: 'x@one.test' });
    await settle();

    expect(only.seen).toEqual(['collection:customers:created:{"email":"x@one.test"}']);
  });
});
