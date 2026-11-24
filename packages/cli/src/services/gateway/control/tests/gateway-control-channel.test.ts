import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import express from 'express';
import { DatabaseFactory } from '@fromcode119/database';
import { ApiPathUtils, EdgeControlEndpoint, EdgeControlPaths, EdgeIdentity, EdgeStop, EdgeX509, InternalServiceAuth, SystemConstants, TenantRouteMap } from '@fromcode119/core';
import { EdgeIdentityMigration } from '@core/database/migrations/074_edge_identity';
import { EdgeIdentityInternalRouter } from '@api/routes/edge-identity-internal-router';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';
import { GatewayControlChannel } from '@cli/services/gateway/control/gateway-control-channel';

/** One edge, as the edge process will be: its own key, the platform's root pinned, mutual TLS. */
class TestEdge {
  key = '';
  cert = '';
  constructor(readonly port: number, readonly ca: string) {}

  async request(method: string, pathname: string, body?: unknown, alpn = EdgeControlPaths.CONTROL): Promise<{ status: number; body: any }> {
    const socket = await this.connect(alpn);
    const payload = body === undefined ? '' : JSON.stringify(body);
    socket.write(`${method} ${pathname} HTTP/1.1\r\nHost: control\r\nUser-Agent: test-edge\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
    const text = await new Promise<string>((resolve) => { let all = ''; socket.on('data', (chunk) => { all += chunk; }); socket.on('close', () => resolve(all)); socket.on('error', () => resolve(all)); });
    const status = Number(text.slice(9, 12));
    const json = text.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    return { status, body: json ? (() => { try { return JSON.parse(json.replace(/^[0-9a-f]+\r\n/, '').replace(/\r\n0\r\n\r\n$/, '')); } catch { return json; } })() : null };
  }

  connect(alpn: string, identity: { key: string; cert: string } | null = this.cert ? { key: this.key, cert: this.cert } : null): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: '127.0.0.1', port: this.port, ca: this.ca, ALPNProtocols: [alpn], minVersion: 'TLSv1.3', ...(identity ?? {}) }, () => resolve(socket));
      socket.once('error', reject);
    });
  }

  async enroll(token: string): Promise<number> {
    const keys = await EdgeX509.generateKeyPair();
    const answer = await this.request('POST', EdgeControlPaths.ENROLL, { token, request: await EdgeX509.request('edge', keys) });
    if (answer.status === 200) { this.key = await EdgeX509.exportPrivateKey(keys.privateKey); this.cert = `${answer.body.certificatePem}${answer.body.chainPem}`; }
    return answer.status;
  }
}

describe('GatewayControlChannel', () => {
  const file = path.join(os.tmpdir(), `fromcode-control-${Date.now()}-${Math.random()}.db`);
  const settings = new Map<string, string>();
  const secret = 'control-channel-test-secret-0123456789';
  let previous: string | undefined;
  let previousKey: string | undefined;
  let api: import('http').Server;
  let identity: EdgeIdentity;
  let channel: GatewayControlChannel;
  let map: TenantRouteMap;
  const tunnels: string[] = [];

  beforeAll(async () => {
    previous = process.env.INTERNAL_SERVICE_SECRET;
    previousKey = process.env.SECRET_KEY;
    process.env.INTERNAL_SERVICE_SECRET = secret;
    process.env.SECRET_KEY = 'control-channel-test-key-0123456789abcdef';
    const db: any = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    await new EdgeIdentityMigration().up(db);
    const port = await new Promise<number>((resolve) => { const probe = net.createServer().listen(0, () => { const { port: free } = probe.address() as net.AddressInfo; probe.close(() => resolve(free)); }); });
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS, '127.0.0.1');
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_PORT, String(port));
    identity = new EdgeIdentity(db, settings, () => 'platform.test');
    const app = express();
    app.use(express.json());
    app.use(ApiPathUtils.versioned(''), new EdgeIdentityInternalRouter({ audit: { logAction: async () => undefined } }, identity).router);
    api = await new Promise((resolve) => { const server = app.listen(0, () => resolve(server)); });
    map = new TenantRouteMap([]).withControl(identity.control()).withStops([new EdgeStop('203.0.113.50', Date.now() + 600_000)]);
    channel = new GatewayControlChannel(() => map, (socket, edge) => { tunnels.push(edge.id); socket.end('tunnel-ok'); }, new GatewayControlApi(`http://127.0.0.1:${(api.address() as net.AddressInfo).port}`));
    await channel.check();
  });
  afterAll(async () => {
    await channel?.stop();
    api?.close();
    fs.rmSync(file, { force: true });
    process.env.INTERNAL_SERVICE_SECRET = previous;
    process.env.SECRET_KEY = previousKey;
  });

  const edge = async () => new TestEdge(channel.listeningPort, await identity.authority.trustBundle());

  it('listens only once configured, presenting a certificate for the control address', async () => {
    expect(channel.listeningPort).toBe(Number(settings.get(SystemConstants.META_KEY.EDGE_CONTROL_PORT)));
    const socket = await (await edge()).connect(EdgeControlPaths.CONTROL, null);
    expect(socket.getProtocol()).toBe('TLSv1.3');
    expect(socket.getPeerCertificate().subjectaltname).toBe('IP Address:127.0.0.1');
    socket.destroy();
  });

  it('adds an edge with its one-time token, then serves it the rules over its own certificate', async () => {
    const { edge: record, token } = await identity.enrollment.add('Relay', 'ops');
    const client = await edge();
    expect(await client.request('GET', EdgeControlPaths.RULES)).toMatchObject({ status: 403 });
    expect(await client.enroll('wrong-token')).toBe(403);
    expect(await client.enroll(token)).toBe(200);
    expect(await new TestEdge(client.port, client.ca).enroll(token)).toBe(403);

    const rules = await client.request('GET', EdgeControlPaths.RULES);
    expect(rules.status).toBe(200);
    expect(rules.body.stops.map((stop: any) => stop.address)).toEqual(['203.0.113.50']);
    expect((await identity.enrollment.find(record.id))?.version).toBe('test-edge');

    // A long poll with the current version hears of a new stop within about a second.
    const waiting = client.request('GET', `${EdgeControlPaths.RULES}?known=${rules.body.version}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    map = map.withStops([...map.stops, new EdgeStop('198.51.100.7', Date.now() + 600_000)]);
    const changed = await waiting;
    expect(changed.status).toBe(200);
    expect(changed.body.stops.map((stop: any) => stop.address).sort()).toEqual(['198.51.100.7', '203.0.113.50']);

    expect(await client.request('POST', EdgeControlPaths.REPORTS, { refused: { '203.0.113.50': 3, '10.0.0.1': 9 } })).toMatchObject({ status: 200 });

    // The tunnel: same port, same certificate, told apart by ALPN.
    const tunnel = await client.connect(EdgeControlPaths.TUNNEL);
    const said = await new Promise<string>((resolve) => { let all = ''; tunnel.on('data', (chunk) => { all += chunk; }); tunnel.on('close', () => resolve(all)); });
    expect(said).toBe('tunnel-ok');
    expect(tunnels).toEqual([record.id]);

    // Removed: it cannot renew, and its next tunnel or request once the short cache runs out is refused.
    await identity.enrollment.revoke(record.id, 'ops');
    const keys = await EdgeX509.generateKeyPair();
    expect(await client.request('POST', EdgeControlPaths.RENEW, { request: await EdgeX509.request('edge', keys) })).toMatchObject({ status: 403 });
  }, 20_000);

  it('refuses a certificate the platform did not issue', async () => {
    const keys = await EdgeX509.generateKeyPair();
    const now = new Date();
    const stranger = await EdgeX509.certificate({ serial: EdgeX509.serial(), subject: 'stranger', issuer: 'stranger', notBefore: now, notAfter: new Date(now.getTime() + 3_600_000), publicKey: keys.publicKey, signingKey: keys.privateKey, clientAuth: true, uri: 'spiffe://platform.test/edge/x' });
    const client = await edge();
    client.key = await EdgeX509.exportPrivateKey(keys.privateKey);
    client.cert = stranger;
    expect(await client.request('GET', EdgeControlPaths.RULES)).toMatchObject({ status: 403 });
    const tunnel = await client.connect(EdgeControlPaths.TUNNEL);
    await new Promise((resolve) => tunnel.on('close', resolve));
    expect(tunnels).toHaveLength(1);
  });
});
