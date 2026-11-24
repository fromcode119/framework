import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import express from 'express';
import { DatabaseFactory } from '@fromcode119/database';
import { ApiPathUtils, EdgeControlEndpoint, EdgeIdentity, EdgeStop, EdgeX509, SystemConstants, TenantRouteMap } from '@fromcode119/core';
import { EdgeIdentityMigration } from '@core/database/migrations/074_edge_identity';
import { EdgeIdentityInternalRouter } from '@api/routes/edge-identity-internal-router';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';
import { GatewayControlChannel } from '@cli/services/gateway/control/gateway-control-channel';
import { GatewayTunnel } from '@cli/services/gateway/control/gateway-tunnel';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';
import { EdgeConfig } from '@cli/services/edge/config/edge-config';
import { EdgeTcpOrigin } from '@cli/services/edge/origins/edge-tcp-origin';
import { EdgeTunnelOrigin } from '@cli/services/edge/origins/edge-tunnel-origin';
import { EdgePlatformRules } from '@cli/services/edge/rules/edge-platform-rules';
import { PlatformEdge as Edge } from '@cli/services/edge/platform-edge';
import { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';

/**
 * An edge as an operator runs one: a configuration file, joined to a platform with the console's command,
 * in front of the platform (through the tunnel) and of an ordinary TLS server (by SNI).
 */
describe('edge in front of a platform and another server', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-edge-'));
  const settings = new Map<string, string>();
  const env = { secret: process.env.INTERNAL_SERVICE_SECRET, key: process.env.SECRET_KEY };
  const closers: Array<() => unknown> = [];
  let identity: EdgeIdentity;
  let map: TenantRouteMap;
  let edge: Edge;
  let edgePort = 0;
  let otherPort = 0;
  const seenByPlatform: string[] = [];

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_SECRET = 'edge-platform-test-secret-0123456789';
    process.env.SECRET_KEY = 'edge-platform-test-key-0123456789abcdef';
    const db: any = DatabaseFactory.create(`sqlite:${path.join(dir, 'db.sqlite')}`);
    await db.connect();
    await new EdgeIdentityMigration().up(db);
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS, '127.0.0.1');
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_PORT, '1');
    identity = new EdgeIdentity(db, settings, () => 'platform.test');
    const app = express();
    app.use(express.json());
    app.use(ApiPathUtils.versioned(''), new EdgeIdentityInternalRouter({ audit: { logAction: async () => undefined } }, identity).router);
    const api = await new Promise<http.Server>((resolve) => { const server = app.listen(0, () => resolve(server)); });
    closers.push(() => api.close());

    // The platform's HTTP side, as the gateway serves it: who the visitor is, as the gateway sees it.
    const site = http.createServer((req, res) => { seenByPlatform.push(String(req.socket.remoteAddress)); res.end(`platform:${req.headers.host}`); });
    const plain = new GatewayListener(site);
    // Port 0: whatever is free, read back below — a port picked in advance can be taken by a test running beside this one.
    map = new TenantRouteMap([]).withControl(new EdgeControlEndpoint('127.0.0.1', 0));
    const channel = new GatewayControlChannel(() => map, (socket, from) => new GatewayTunnel(() => plain, () => null).accept(socket, from), new GatewayControlApi(`http://127.0.0.1:${(api.address() as net.AddressInfo).port}`));
    await channel.check();
    closers.push(() => channel.stop());
    const controlPort = channel.listeningPort;

    // An ordinary TLS server that is not a Fromcode platform.
    const keys = await EdgeX509.generateKeyPair();
    const now = new Date();
    const cert = await EdgeX509.certificate({ serial: EdgeX509.serial(), subject: 'other.test', issuer: 'other.test', notBefore: now, notAfter: new Date(now.getTime() + 3_600_000), publicKey: keys.publicKey, signingKey: keys.privateKey, serverAuth: true, dnsNames: ['other.test'] });
    const other = tls.createServer({ key: await EdgeX509.exportPrivateKey(keys.privateKey), cert }, (socket) => socket.end('other-server'));
    await new Promise<void>((resolve) => other.listen(0, resolve));
    otherPort = (other.address() as net.AddressInfo).port;
    closers.push(() => other.close());

    // The console's "Add edge": a token, and the command with the root's hash.
    const { token } = await identity.enrollment.add('Test edge', 'ops');
    const root = EdgeIdentityStore.fingerprint(await identity.authority.trustBundle());
    const state = path.join(dir, 'state');
    await expect(new EdgeIdentityStore(state, 'fromcode-edge/test').join(`127.0.0.1:${controlPort}`, token, 'sha256:00')).rejects.toThrow(/does not match/);
    await new EdgeIdentityStore(state, 'fromcode-edge/test').join(`127.0.0.1:${controlPort}`, token, root);
    expect((fs.statSync(path.join(state, 'key.pem')).mode & 0o777).toString(8)).toBe('600');

    // The configuration as an operator writes it; the listeners then bound on free ports for the test.
    const config = EdgeConfig.parse({
      listeners: [{ port: 443, protocol: 'tls' }, { port: 80, protocol: 'http' }],
      origins: [
        { name: 'other', hosts: ['other.test'], transport: 'tcp', address: '127.0.0.1', ports: { tls: otherPort, http: otherPort }, proxyProtocol: false, health: { type: 'tcp' } },
        { name: 'platform', hosts: ['*'], transport: 'fromcode' },
      ],
      rules: { source: 'fromcode' },
      fromcode: { state },
    });
    const store = new EdgeIdentityStore(state, 'fromcode-edge/test');
    expect(store.load()).toBe(true);
    const origins = config.origins.map((origin) => (origin.transport === 'fromcode' ? new EdgeTunnelOrigin(origin, store) : new EdgeTcpOrigin(origin)));
    edge = new Edge(config.listeners.map((listener) => ({ ...listener, port: 0 })), origins, new EdgePlatformRules(store, state, 'fromcode-edge/test'));
    const [tlsPort, httpPort] = await edge.start();
    edgePort = tlsPort;
    closers.push(() => edge.stop(0));
    (edge as any).httpPort = httpPort;
  }, 30_000);

  afterAll(async () => {
    for (const close of closers.reverse()) await close();
    fs.rmSync(dir, { recursive: true, force: true });
    process.env.INTERNAL_SERVICE_SECRET = env.secret;
    process.env.SECRET_KEY = env.key;
  });

  const get = (port: number, host: string, extra: Buffer = Buffer.alloc(0)): Promise<string> => new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => socket.write(Buffer.concat([extra, Buffer.from(`GET / HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`)])));
    let text = '';
    socket.on('data', (chunk) => { text += chunk; });
    socket.on('close', () => resolve(text));
    socket.on('error', () => resolve(text));
  });

  it('carries a visitor through the tunnel, and the platform sees the real visitor', async () => {
    const text = await get((edge as any).httpPort, 'shop.example.test');
    expect(text).toContain('platform:shop.example.test');
    expect(seenByPlatform.at(-1)).toMatch(/127\.0\.0\.1$/);
  });

  it('sends a host another server owns to that server by SNI, untouched', async () => {
    const said = await new Promise<string>((resolve, reject) => {
      const socket = tls.connect({ host: '127.0.0.1', port: edgePort, servername: 'other.test', rejectUnauthorized: false }, () => undefined);
      let text = '';
      socket.on('data', (chunk) => { text += chunk; });
      socket.on('close', () => resolve(text));
      socket.on('error', reject);
    });
    expect(said).toBe('other-server');
  });

  it('refuses a visitor who sends a PROXY header of their own', async () => {
    const forged = GatewayProxyProtocol.header('198.51.100.66', 1234);
    expect(await get((edge as any).httpPort, 'shop.example.test', forged)).toBe('');
  });

  it('refuses an address at connect within moments of the platform stopping it', async () => {
    map = map.withStops([new EdgeStop('127.0.0.1', Date.now() + 600_000)]);
    let text = 'not yet';
    for (let i = 0; i < 40 && text !== ''; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      text = await get((edge as any).httpPort, 'shop.example.test');
    }
    expect(text).toBe('');
    map = map.withStops([]);
  }, 20_000);
});
