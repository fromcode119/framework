import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import http from 'http';
import http2 from 'http2';
import net from 'net';
import httpProxy from 'http-proxy';
import tls from 'tls';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { InternalServiceAuth } from '@fromcode119/core';
import { CertificateBundleClient } from '@cli/services/certificate-bundle-client';
import { GatewayTlsListener } from '@cli/services/gateway-tls-listener';
import { GatewayProxyProtocol } from '@cli/services/gateway/gateway-proxy-protocol';
import { PlatformGateway } from '@cli/services/platform-gateway';

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
    void listener?.listener?.stop(0);
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
    await listener!.listener!.listening;
    return listener!.listener!.port;
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

  it('takes the visitor from the PROXY header `edge` sends ahead of the handshake', async () => {
    const client = new CertificateBundleClient('http://api.invalid/certificates', 60_000,
      (async () => ({ ok: true, json: async () => bundleJson() })) as unknown as typeof fetch);
    listener = new GatewayTlsListener(0, client);
    listener.start({ request: (req, res) => { res.writeHead(200); res.end(String(req.socket.remoteAddress)); }, upgrade: (_r, s) => s.destroy() });
    await listener.listener!.listening;
    const raw = net.connect({ port: listener.listener!.port, host: '127.0.0.1' });
    await new Promise((resolve) => raw.once('connect', resolve));
    raw.write(GatewayProxyProtocol.header('203.0.113.7', 40123));
    const body = await new Promise<string>((resolve, reject) => {
      const socket = tls.connect({ socket: raw, servername: 'served.test', rejectUnauthorized: false }, () => {
        socket.write('GET / HTTP/1.1\r\nHost: served.test\r\nConnection: close\r\n\r\n');
      });
      let text = '';
      socket.on('data', (chunk) => { text += chunk.toString(); });
      socket.on('end', () => resolve(text));
      socket.on('error', reject);
    });
    expect(body).toMatch(/^HTTP\/1\.1 200/);
    expect(body).toContain('203.0.113.7');
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

/**
 * HTTP/2 end to end: a real TLS handshake that negotiates h2, a request carried over it, and the
 * gateway's own proxy forwarding it to an HTTP/1.1 upstream that answers with connection-level
 * headers HTTP/2 forbids — the exact path a browser's request takes in production.
 */
describe('GatewayTlsListener — HTTP/2', () => {
  let dir = '';
  let listener: GatewayTlsListener | null = null;
  let upstream: http.Server | null = null;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fc-h2-'));
    process.env[InternalServiceAuth.ENV_KEY] = process.env[InternalServiceAuth.ENV_KEY] || 'test-internal-secret';
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'served.key',
      '-out', 'served.crt', '-days', '5', '-subj', '/CN=served.test',
      '-addext', 'subjectAltName=DNS:served.test'], { cwd: dir, stdio: 'pipe' });
  });

  afterEach(async () => {
    await listener?.stop(0);
    listener = null;
    upstream?.close();
    upstream = null;
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  /** The gateway's TLS listener in front of an HTTP/1.1 upstream, through the gateway's proxy rules. */
  const start = async (): Promise<number> => {
    upstream = http.createServer((req, res) => {
      res.writeHead(200, { connection: 'keep-alive', 'keep-alive': 'timeout=5', 'transfer-encoding': 'chunked', 'x-seen-host': String(req.headers.host) });
      res.end(`${req.method} ${req.url}`);
    });
    await new Promise<void>((resolve) => upstream!.listen(0, '127.0.0.1', resolve));
    const target = `http://127.0.0.1:${(upstream.address() as net.AddressInfo).port}`;
    const proxy = httpProxy.createProxyServer({});
    proxy.on('proxyRes', (proxyRes, req) => { PlatformGateway.toHttp2(proxyRes, req); });

    const bundle = {
      certificates: [{
        host: 'served.test',
        certificatePem: readFileSync(join(dir, 'served.crt'), 'utf8'),
        privateKeyPem: readFileSync(join(dir, 'served.key'), 'utf8'),
        notAfter: new Date(Date.now() + 86_400_000).toISOString(),
      }],
    };
    const client = new CertificateBundleClient('http://api.invalid/certificates', 60_000,
      (async () => ({ ok: true, json: async () => bundle })) as unknown as typeof fetch);
    listener = new GatewayTlsListener(0, client);
    listener.start({
      request: (req, res) => { PlatformGateway.fromHttp2(req); proxy.web(req, res, { target }); },
      upgrade: (_r, s) => s.destroy(),
    });
    await listener.listener!.listening;
    return listener.listener!.port;
  };

  it('negotiates h2 with a client that offers it and proxies the request to an HTTP/1.1 upstream', async () => {
    const port = await start();
    const session = http2.connect(`https://served.test:${port}`, {
      servername: 'served.test', rejectUnauthorized: false,
      createConnection: () => tls.connect({ port, host: '127.0.0.1', servername: 'served.test', rejectUnauthorized: false, ALPNProtocols: ['h2'] }),
    });
    const { status, headers, body } = await new Promise<{ status: number; headers: http2.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const stream = session.request({ ':path': '/page?x=1', ':method': 'GET', ':authority': 'served.test' });
      let headers: http2.IncomingHttpHeaders = {};
      let body = '';
      stream.on('response', (h) => { headers = h; });
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => { body += chunk; });
      stream.on('end', () => resolve({ status: Number(headers[':status']), headers, body }));
      stream.on('error', reject);
      stream.end();
    });
    session.close();
    expect(status).toBe(200);
    expect(body).toBe('GET /page?x=1');
    expect(headers['x-seen-host']).toBe('served.test');
    expect(headers.connection).toBeUndefined();
  });

  it('on stop, tells an open HTTP/2 session to go away instead of holding the deploy for the whole grace period', async () => {
    const port = await start();
    const session = http2.connect(`https://served.test:${port}`, {
      createConnection: () => tls.connect({ port, host: '127.0.0.1', servername: 'served.test', rejectUnauthorized: false, ALPNProtocols: ['h2'] }),
    });
    await new Promise<void>((resolve, reject) => {
      const stream = session.request({ ':path': '/', ':method': 'GET', ':authority': 'served.test' });
      stream.on('data', () => undefined);
      stream.on('end', () => resolve());
      stream.on('error', reject);
      stream.end();
    });
    const goaway = new Promise<void>((resolve) => session.once('goaway', () => resolve()));
    const began = Date.now();
    await listener!.stop(10_000);
    await goaway;
    expect(Date.now() - began).toBeLessThan(5_000);
    session.destroy();
  }, 15_000);

  it('still serves HTTP/1.1 to a client that asks for it', async () => {
    const port = await start();
    const body = await new Promise<string>((resolve, reject) => {
      const socket = tls.connect({ port, host: '127.0.0.1', servername: 'served.test', rejectUnauthorized: false, ALPNProtocols: ['http/1.1'] }, () => {
        expect(socket.alpnProtocol).toBe('http/1.1');
        socket.write('GET /plain HTTP/1.1\r\nHost: served.test\r\nConnection: close\r\n\r\n');
      });
      let raw = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        raw += chunk;
        // The whole chunked body has arrived; the connection itself may stay open (keep-alive).
        if (raw.includes('\r\n0\r\n\r\n')) { socket.destroy(); resolve(raw); }
      });
      socket.on('error', reject);
    });
    expect(body.startsWith('HTTP/1.1 200')).toBe(true);
    expect(body).toContain('GET /plain');
  });
});
