import { describe, expect, it } from 'vitest';
import { TenantRecord, TenantRouteMap } from '@fromcode119/core';
import { PlatformGateway } from '@cli/services/platform-gateway';

const targets = { api: 'http://api:3000', admin: 'http://admin:3000', frontend: 'http://frontend:3000' };
const site = TenantRecord.from({ id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["api.acme.test"]', state: 'active', kind: 'site' });
const workspace = TenantRecord.from({ id: 'workspace-a', slug: 'workspace-a', primary_host: 'workspace-a.test', host_aliases: '[]', state: 'active', kind: 'workspace', appearance: 'workspace-a' });
const map = TenantRouteMap.build([site, workspace], { admin: 'admin.platform.test', api: 'api.platform.test', frontend: 'frontend.platform.test' });

describe('PlatformGateway.resolveTarget', () => {
  it('routes by host from the tenant table: site → frontend, workspace → admin, api. alias → api', () => {
    expect(PlatformGateway.resolveTarget(map, 'acme.test', '/', targets)).toBe(targets.frontend);
    expect(PlatformGateway.resolveTarget(map, 'workspace-a.test', '/alpha/affiliates', targets)).toBe(targets.admin);
    expect(PlatformGateway.resolveTarget(map, 'api.acme.test', '/api/v1/plugins/chi/gw', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'admin.platform.test', '/', targets)).toBe(targets.admin);
  });

  it('a workspace console reaches the api on its own origin: /api and asset paths on an admin host go to the api', () => {
    expect(PlatformGateway.resolveTarget(map, 'workspace-a.test', '/api/v1/auth/host', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'workspace-a.test', '/plugins/alpha/ui/bundle.js', targets)).toBe(targets.api);
    // A SITE's storefront reaches the api on its own host too, so the site's name survives the call.
    expect(PlatformGateway.resolveTarget(map, 'acme.test', '/api/v1/system/frontend', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'acme.test', '/shop/cosmic-box', targets)).toBe(targets.frontend);
    expect(PlatformGateway.resolveTarget(map, 'workspace-a.test', '/uploads/2026/09/logo.png', targets)).toBe(targets.api);
  });

  it('the admin keeps its own pages on an admin host: /media and /plugins/<slug>/settings are not api paths', () => {
    for (const host of ['admin.platform.test', 'workspace-a.test']) {
      expect(PlatformGateway.resolveTarget(map, host, '/media', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/chi/settings', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/installed', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/themes', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/zeta/ui/bundle.js', targets)).toBe(targets.api);
      expect(PlatformGateway.resolveTarget(map, host, '/api/v1/system/admin/metadata', targets)).toBe(targets.api);
    }
  });

  it('answers a host nobody owns with nothing — fail-closed, like the api', () => {
    expect(PlatformGateway.resolveTarget(map, 'stranger.test', '/', targets)).toBeNull();
  });

  it('without a routing map it is the single-domain gateway it always was: path rules', () => {
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/api/v1/health', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/admin/sites', targets)).toBe(targets.admin);
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/shop', targets)).toBe(targets.frontend);
  });
});

describe('PlatformGateway under a burst', () => {
  it('serves every request of one page load and stays up', async () => {
    const http = await import('http');
    const upstream = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => upstream.listen(0, resolve));
    const upstreamPort = (upstream.address() as any).port;

    process.env.PORT = '0';
    process.env.API_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    process.env.FRONTEND_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    const gateway = new PlatformGateway({ refresh: async () => null, resolveMap: async () => null, map: () => null, enabled: false, ageMs: 0 } as any);
    gateway.start();
    const server = (gateway as any).server as import('http').Server;
    await new Promise<void>((resolve) => server.listening ? resolve() : server.once('listening', () => resolve()));
    const port = (server.address() as any).port;

    // One storefront page load is a burst, not a trickle. A gateway that opened and closed a socket per
    // call answered `Parse Error: Data after 'Connection: close'` and then DIED on the first response it
    // could no longer write to — every site 502 until the container came back.
    const statuses = await Promise.all(Array.from({ length: 25 }, () =>
      fetch(`http://127.0.0.1:${port}/api/v1/system/frontend`).then((r) => r.status).catch((e) => String(e))));
    expect(statuses.every((status) => status === 200)).toBe(true);

    server.close();
    upstream.close();
  });
});
