import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import tls from 'tls';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { InternalServiceAuth } from '@fromcode119/core';
import { CertificateBundleClient } from '@cli/services/certificate-bundle-client';
import { GatewayTlsListener } from '@cli/services/gateway-tls-listener';

/**
 * REAL handshakes against a real listener, because every promise this class makes is a handshake
 * outcome. A unit test that only checked which context was chosen would pass while the listener
 * happily answered an unknown name with somebody else's certificate — which is precisely the
 * failure the no-default-certificate rule exists to prevent.
 */
describe('GatewayTlsListener — what the platform answers a handshake with', () => {
  let dir = '';
  let listener: GatewayTlsListener | null = null;

  const bundleJson = (): unknown => ({
    certificates: [{
      host: 'served.test',
      certificatePem: readFileSync(join(dir, 'served.crt'), 'utf8'),
      privateKeyPem: readFileSync(join(dir, 'served.key'), 'utf8'),
      notAfter: new Date(Date.now() + 86_400_000).toISOString(),
    }],
  });

  beforeAll(() => {
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
    dir = mkdtempSync(join(tmpdir(), 'fc-tls-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'served.key',
      '-out', 'served.crt', '-days', '5', '-subj', '/CN=served.test',
      '-addext', 'subjectAltName=DNS:served.test'], { cwd: dir, stdio: 'pipe' });
    process.env[InternalServiceAuth.ENV_KEY] = process.env[InternalServiceAuth.ENV_KEY] || 'test-internal-secret';
  });

  afterEach(() => {
    listener?.server?.close();
    listener = null;
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  /** A listener on an ephemeral port, fed a bundle without touching the network. */
  const start = async (): Promise<number> => {
    const client = new CertificateBundleClient('http://api.invalid/certificates', 60_000,
      (async () => ({ ok: true, json: async () => bundleJson() })) as unknown as typeof fetch);
    listener = new GatewayTlsListener(0, client);
    listener.start({ request: (_req, res) => { res.writeHead(200); res.end('ok'); }, upgrade: (_r, s) => s.destroy() });
    await new Promise((resolve) => listener!.server!.once('listening', resolve));
    return (listener!.server!.address() as { port: number }).port;
  };

  /** Resolves with the peer's subject, or rejects — which is what a refused handshake looks like. */
  const handshake = (port: number, servername?: string): Promise<string> => new Promise((resolve, reject) => {
    const socket = tls.connect({ port, host: '127.0.0.1', servername, rejectUnauthorized: false }, () => {
      const subject = socket.getPeerCertificate()?.subject?.CN ?? '';
      socket.end();
      resolve(String(subject));
    });
    socket.on('error', reject);
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('timeout')); });
  });

  it('answers a host it has a certificate for', async () => {
    const port = await start();
    await expect(handshake(port, 'served.test')).resolves.toBe('served.test');
  });

  it('REFUSES a host it has nothing for — never another host\'s certificate', async () => {
    const port = await start();
    await expect(handshake(port, 'not-served.test')).rejects.toThrow();
  });

  it('REFUSES a client that sends no server name at all', async () => {
    const port = await start();
    // No `servername`, so no SNI is sent and there is no default context to fall back to.
    await expect(handshake(port)).rejects.toThrow();
  });

  it('serves the same host repeatedly, from the cached context', async () => {
    const port = await start();
    await expect(handshake(port, 'served.test')).resolves.toBe('served.test');
    await expect(handshake(port, 'served.test')).resolves.toBe('served.test');
    expect(listener!.size).toBe(1);
  });

  it('is OFF unless a port is configured — an unset env must change nothing', () => {
    const previous = process.env[GatewayTlsListener.ENV_PORT];
    delete process.env[GatewayTlsListener.ENV_PORT];
    expect(GatewayTlsListener.readPort()).toBeNull();

    process.env[GatewayTlsListener.ENV_PORT] = 'not-a-port';
    expect(GatewayTlsListener.readPort()).toBeNull();

    process.env[GatewayTlsListener.ENV_PORT] = '8443';
    expect(GatewayTlsListener.readPort()).toBe(8443);

    if (previous === undefined) delete process.env[GatewayTlsListener.ENV_PORT];
    else process.env[GatewayTlsListener.ENV_PORT] = previous;
  });
});
