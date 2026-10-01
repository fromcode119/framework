import http from 'http';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { WebSocketManager } from '@core/realtime/web-socket-manager';
import { RealtimeRoomTokens } from '@core/realtime/realtime-room-tokens';
import { RealtimeContextProxy } from '@core/plugin/context/realtime';
import { RealtimeRoomClient } from '@core/realtime/realtime-room-client';
import { ApiVersionUtils } from '@core/api-version';
import type { IRealtimeSocketBinding } from '@core/realtime/interfaces/realtime-socket-binding.interface';

/**
 * A visitor in a live chat has no administrator's session, and must hear their own conversation and
 * nothing else: not the site's writes, not another visitor's room, not another site.
 */
describe('realtime rooms', () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const close of closers.splice(0)) await close();
    TenantMode.reset();
  });

  /** `_system_meta` per site — the signing root lives there, one per site. */
  function siteManager(): any {
    const rows = new Map<string, Map<string, string>>();
    const table = () => {
      const site = String(RequestContextUtils.getTenantId() ?? '-');
      if (!rows.has(site)) rows.set(site, new Map());
      return rows.get(site)!;
    };
    return {
      db: {
        findOne: async (_t: string, where: { key: string }) => (table().has(where.key) ? { key: where.key, value: table().get(where.key) } : null),
        insert: async (_t: string, row: { key: string; value: string }) => { table().set(row.key, row.value); return row; },
        update: async (_t: string, where: { key: string }, patch: { value: string }) => { table().set(where.key, patch.value); return patch; },
        withTenant: async (_id: string, fn: () => Promise<unknown>) => fn(),
      },
    };
  }

  const onSite = <T>(tenantId: string | undefined, fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId } as any, fn);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const sites = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

  /** A real server; `?room=` is checked by the real token verifier, anything else is an admin of `?site=`. */
  async function serve(hooks: HookManager, tokens: RealtimeRoomTokens) {
    const manager = new WebSocketManager(hooks);
    const server = http.createServer();
    const wss = manager.initialize(server)!;
    server.on('upgrade', async (request, socket, head) => {
      const url = new URL(request.url || '', 'http://x');
      let binding: IRealtimeSocketBinding | null = { tenantId: url.searchParams.get('site') };
      if (url.searchParams.has('room')) binding = await tokens.verify(url.searchParams.get('room') || '');
      if (!binding) { socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; }
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request, binding));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closers.push(async () => { manager.close(); await new Promise<void>((resolve) => server.close(() => resolve())); });
    const port = (server.address() as any).port;
    return {
      async connect(query: string) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/socket?${query}`);
        const seen: string[] = [];
        ws.on('message', (data) => {
          const message = JSON.parse(String(data));
          if (message.type !== 'system:ready') seen.push(`${message.plugin ?? ''}|${message.type}|${JSON.stringify(message.payload)}`);
        });
        await new Promise<void>((resolve) => { ws.on('open', () => resolve()); ws.on('close', () => resolve()); ws.on('error', () => resolve()); });
        return { ws, seen };
      },
    };
  }

  it('a room socket hears its own room on its own site, and none of the site\'s writes', async () => {
    sites();
    const manager = siteManager();
    const tokens = new RealtimeRoomTokens(manager);
    const helpdesk = RealtimeContextProxy.createRealtimeProxy(manager, 'helpdesk');
    const other = RealtimeContextProxy.createRealtimeProxy(manager, 'other');
    const hooks = new HookManager();
    const server = await serve(hooks, tokens);

    const visitor = await server.connect(`room=${encodeURIComponent(await onSite('alpha', () => helpdesk.roomToken('conversation-1')))}`);
    const neighbour = await server.connect(`room=${encodeURIComponent(await onSite('alpha', () => helpdesk.roomToken('conversation-2')))}`);
    const elsewhere = await server.connect(`room=${encodeURIComponent(await onSite('beta', () => helpdesk.roomToken('conversation-1')))}`);
    const admin = await server.connect('site=alpha');

    await onSite('alpha', () => helpdesk.emit('conversation-1', 'message', { body: 'hello' }));
    await onSite('alpha', () => other.emit('conversation-1', 'message', { body: 'not yours' }));
    await onSite('alpha', () => hooks.call('collection:customers:afterCreate', { email: 'a@alpha.test' }));
    await settle();

    expect(visitor.seen).toEqual(['helpdesk|message|{"body":"hello"}']);
    expect(neighbour.seen).toEqual([]);
    expect(elsewhere.seen).toEqual([]);
    expect(admin.seen).toEqual(['|collection:customers:created|{"email":"a@alpha.test"}']);
  });

  it('a room socket only listens: what it sends never reaches the hook bus', async () => {
    sites();
    const manager = siteManager();
    const hooks = new HookManager();
    const heard: unknown[] = [];
    hooks.on('socket:message:*', (data: unknown) => { heard.push(data); });
    const server = await serve(hooks, new RealtimeRoomTokens(manager));
    const token = await onSite('alpha', () => RealtimeContextProxy.createRealtimeProxy(manager, 'helpdesk').roomToken('conversation-1'));
    const visitor = await server.connect(`room=${encodeURIComponent(token)}`);
    visitor.ws.send(JSON.stringify({ type: 'ping', payload: {} }));
    await settle();
    expect(heard).toEqual([]);
  });

  it('refuses a forged, altered, expired or foreign-site token', async () => {
    sites();
    const manager = siteManager();
    const tokens = new RealtimeRoomTokens(manager);
    const token = await onSite('alpha', () => tokens.mint('helpdesk:conversation-1'));
    expect(await tokens.verify(token)).toEqual({ tenantId: 'alpha', room: 'helpdesk:conversation-1' });

    const [version, payload, signature] = token.split('.');
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const forge = (patch: Record<string, unknown>) => `${version}.${Buffer.from(JSON.stringify({ ...claim, ...patch })).toString('base64url')}.${signature}`;
    expect(await tokens.verify(forge({ r: 'helpdesk:conversation-2' }))).toBeNull();
    expect(await tokens.verify(forge({ s: 'beta' }))).toBeNull();
    expect(await tokens.verify(forge({ e: 1 }))).toBeNull();
    expect(await tokens.verify(`${version}.${payload}.${'0'.repeat(64)}`)).toBeNull();
    expect(await tokens.verify('nonsense')).toBeNull();

    // Beta's own key, beta's own token: valid for beta, and only there.
    const beta = await onSite('beta', () => tokens.mint('helpdesk:conversation-1'));
    expect(await tokens.verify(beta)).toEqual({ tenantId: 'beta', room: 'helpdesk:conversation-1' });
    expect(beta.split('.')[2]).not.toEqual(signature);
  });

  it('a room belongs to a site: no token and no event without one', async () => {
    sites();
    const realtime = RealtimeContextProxy.createRealtimeProxy(siteManager(), 'helpdesk');
    await expect(onSite(undefined, () => realtime.roomToken('conversation-1'))).rejects.toThrow(/site/);
    await expect(onSite(undefined, () => realtime.emit('conversation-1', 'message', {}))).rejects.toThrow(/site/);
  });

  it('refuses room names and events it cannot carry', async () => {
    sites();
    const realtime = RealtimeContextProxy.createRealtimeProxy(siteManager(), 'helpdesk');
    await expect(onSite('alpha', () => realtime.roomToken(''))).rejects.toThrow(/room name/);
    await expect(onSite('alpha', () => realtime.emit('a b', 'message', {}))).rejects.toThrow(/room name/);
    await expect(onSite('alpha', () => realtime.emit('conversation-1', '', {}))).rejects.toThrow(/event type/);
    await expect(onSite('alpha', () => realtime.emit('conversation-1', 'message', { body: 'x'.repeat(70_000) }))).rejects.toThrow(/limited/);
  });

  it('the socket lives under the versioned api path — the one prefix every host hands to the api', () => {
    expect(RealtimeRoomClient.socketPath()).toBe(`${ApiVersionUtils.prefix()}/socket`);
    expect(RealtimeRoomClient.socketPath()).toMatch(/^\/api\/v\d+\/socket$/);
  });
});
