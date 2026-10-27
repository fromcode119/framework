import { describe, expect, it } from 'vitest';
import http from 'http';
import { ConsoleMountConstants, TenantRecord, TenantRouteMap } from '@fromcode119/core';
import { GatewayConsoleMount } from '@cli/services/gateway/gateway-console-mount';

const targets = { api: 'http://api:3000', admin: 'http://admin:3000', frontend: 'http://frontend:3000' };
const site = TenantRecord.from({ id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["shop.acme.test"]', state: 'active', kind: 'site', console_path: '/backend' });
const plain = TenantRecord.from({ id: 'plain', slug: 'plain', primary_host: 'plain.test', host_aliases: '[]', state: 'active', kind: 'site' });
const map = TenantRouteMap.build([site, plain], { admin: 'admin.platform.test', api: 'api.platform.test', frontend: 'frontend.platform.test' });

describe('GatewayConsoleMount.resolve', () => {
  it('strips the console path on every storefront host of the site', () => {
    for (const host of ['acme.test', 'shop.acme.test']) {
      expect(GatewayConsoleMount.resolve(map, host, '/backend')).toEqual({ mount: '/backend', url: '/' });
      expect(GatewayConsoleMount.resolve(map, host, '/backend/settings/general')).toEqual({ mount: '/backend', url: '/settings/general' });
      expect(GatewayConsoleMount.resolve(map, host, '/backend?next=%2Fx')).toEqual({ mount: '/backend', url: '/?next=%2Fx' });
      expect(GatewayConsoleMount.resolve(map, host, '/backend/x?_rsc=1')).toEqual({ mount: '/backend', url: '/x?_rsc=1' });
    }
  });

  it('leaves the storefront its own pages, including ones that only start with the same letters', () => {
    expect(GatewayConsoleMount.resolve(map, 'acme.test', '/')).toBeNull();
    expect(GatewayConsoleMount.resolve(map, 'acme.test', '/backendless')).toBeNull();
    expect(GatewayConsoleMount.resolve(map, 'acme.test', '/_next/static/chunk.js')).toBeNull();
  });

  it('hands the admin its assets on a mounted host only', () => {
    expect(GatewayConsoleMount.resolve(map, 'acme.test', `${ConsoleMountConstants.ASSET_PREFIX}/_next/static/a.js`)).toEqual({ mount: '/backend', url: `${ConsoleMountConstants.ASSET_PREFIX}/_next/static/a.js` });
    expect(GatewayConsoleMount.resolve(map, 'plain.test', `${ConsoleMountConstants.ASSET_PREFIX}/_next/static/a.js`)).toBeNull();
  });

  it('never mounts on a site without a path, an admin host, the api paths, or during setup', () => {
    expect(GatewayConsoleMount.resolve(map, 'plain.test', '/backend')).toBeNull();
    expect(GatewayConsoleMount.resolve(map, 'admin.platform.test', '/backend')).toBeNull();
    expect(GatewayConsoleMount.resolve(map, 'acme.test', '/api/auth/me')).toBeNull();
    expect(GatewayConsoleMount.resolve(map, 'acme.test', '/uploads/a.png')).toBeNull();
    expect(GatewayConsoleMount.resolve(null, 'acme.test', '/backend')).toBeNull();
  });

  it('sends the console to the admin, and an api path inside the mount to the api', () => {
    expect(GatewayConsoleMount.targetFor({ url: '/settings' }, targets)).toBe(targets.admin);
    expect(GatewayConsoleMount.targetFor({ url: '/api/auth/me' }, targets)).toBe(targets.api);
  });
});

describe('GatewayConsoleMount.rewriteLocation', () => {
  it('puts the admin\'s own redirects back under the mount', () => {
    expect(GatewayConsoleMount.rewriteLocation('/login?next=%2F', '/backend', 'acme.test')).toBe('/backend/login?next=%2F');
    expect(GatewayConsoleMount.rewriteLocation('/', '/backend', 'acme.test')).toBe('/backend');
    expect(GatewayConsoleMount.rewriteLocation('https://acme.test/login', '/backend', 'acme.test')).toBe('https://acme.test/backend/login');
  });

  it('leaves what is already mounted, other hosts, the api and the asset root alone', () => {
    expect(GatewayConsoleMount.rewriteLocation('/backend/login', '/backend', 'acme.test')).toBe('/backend/login');
    expect(GatewayConsoleMount.rewriteLocation('https://other.test/login', '/backend', 'acme.test')).toBe('https://other.test/login');
    expect(GatewayConsoleMount.rewriteLocation('//other.test/x', '/backend', 'acme.test')).toBe('//other.test/x');
    expect(GatewayConsoleMount.rewriteLocation('/api/auth/me', '/backend', 'acme.test')).toBe('/api/auth/me');
  });
});

describe('GatewayConsoleMount.applyHeader', () => {
  it('drops a mount a client claims and sets only the gateway\'s', () => {
    const req = { headers: { [ConsoleMountConstants.HEADER]: '/forged' } } as unknown as http.IncomingMessage;
    GatewayConsoleMount.applyHeader(req, null);
    expect(req.headers[ConsoleMountConstants.HEADER]).toBeUndefined();
    GatewayConsoleMount.applyHeader(req, '/backend');
    expect(req.headers[ConsoleMountConstants.HEADER]).toBe('/backend');
  });
});
