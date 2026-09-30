import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { PublicNetworkFetch } from '@core/security/public-network-fetch';

describe('PublicNetworkFetch', () => {
  let server: http.Server;
  let base = '';
  const seen: Array<{ method: string; url: string; authorization?: string }> = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push({ method: String(req.method), url: String(req.url), authorization: req.headers.authorization });
      if (req.url === '/to-metadata') { res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }); res.end(); return; }
      if (req.url === '/to-loopback-name') { res.writeHead(307, { location: 'http://internal.example/secret' }); res.end(); return; }
      if (req.url === '/see-other') { res.writeHead(303, { location: '/landed' }); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(`landed ${req.method} ${req.url}`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    seen.length = 0;
  });

  /** The test server listens on 127.0.0.1; for the redirect cases it stands in for a public host. */
  const treatTestServerAsPublic = () => {
    const real = NetworkAddressUtils.isPublic.bind(NetworkAddressUtils);
    vi.spyOn(NetworkAddressUtils, 'isPublic').mockImplementation((address: unknown) => address === '127.0.0.1' || real(address));
  };

  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5:6379/',
    'http://172.18.0.3:5432/',
    'http://192.168.1.1/',
    'http://0.0.0.0/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://[fd00::1]/',
  ])('refuses the non-public address %s before connecting', async (url) => {
    await expect(PublicNetworkFetch.fetch(url)).rejects.toMatchObject({ code: PublicNetworkFetch.REFUSED_CODE });
  });

  it('refuses anything but http and https', async () => {
    await expect(PublicNetworkFetch.fetch('file:///etc/passwd')).rejects.toMatchObject({ code: PublicNetworkFetch.REFUSED_CODE });
  });

  it('refuses a NAME that resolves to a private address, at connect, with the reason rather than "fetch failed"', async () => {
    const error = await PublicNetworkFetch.fetch('http://localhost:8099/').catch((caught) => caught);
    expect(PublicNetworkFetch.isRefusal(error)).toBe(true);
    expect(String(error.message)).toMatch(/localhost: it resolves to .*not a public internet address/);
  });

  it('checks every redirect hop — a public URL cannot bounce the request to the metadata address or an internal name', async () => {
    treatTestServerAsPublic();
    const dns = (await import('node:dns')).default;
    const realLookup = dns.lookup.bind(dns);
    vi.spyOn(dns, 'lookup').mockImplementation(((host: string, options: any, callback: (...args: any[]) => void) =>
      host === 'internal.example' ? callback(null, [{ address: '172.18.0.3', family: 4 }]) : (realLookup as any)(host, options, callback)) as any);
    await expect(PublicNetworkFetch.fetch(`${base}/to-metadata`)).rejects.toMatchObject({ code: PublicNetworkFetch.REFUSED_CODE });
    await expect(PublicNetworkFetch.fetch(`${base}/to-loopback-name`)).rejects.toMatchObject({ code: PublicNetworkFetch.REFUSED_CODE });
  });

  it('follows an allowed redirect as fetch does: 303 turns a POST into a GET', async () => {
    treatTestServerAsPublic();
    const response = await PublicNetworkFetch.fetch(`${base}/see-other`, { method: 'POST', body: 'x', headers: { authorization: 'Bearer same-origin' } });
    expect(await response.text()).toBe('landed GET /landed');
    expect(seen.map((entry) => `${entry.method} ${entry.url}`)).toEqual(['POST /see-other', 'GET /landed']);
    expect(seen[1].authorization).toBe('Bearer same-origin');
  });

  it('hands a redirect back untouched when the caller asked for manual redirects', async () => {
    treatTestServerAsPublic();
    const response = await PublicNetworkFetch.fetch(`${base}/to-metadata`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(seen).toHaveLength(1);
  });

  it('lets a request to a public address through', async () => {
    treatTestServerAsPublic();
    const response = await PublicNetworkFetch.fetch(`${base}/hello`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('landed GET /hello');
  });

  it('refuses a name when ANY of its addresses is private', async () => {
    const dns = (await import('node:dns')).default;
    vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _options: unknown, callback: (...args: any[]) => void) =>
      callback(null, [{ address: '8.8.8.8', family: 4 }, { address: '172.18.0.3', family: 4 }])) as any);
    const result = await new Promise<{ error: any; value: any }>((resolve) =>
      PublicNetworkFetch.lookup('mixed.example', { all: true }, (error: any, value: any) => resolve({ error, value })));
    expect(PublicNetworkFetch.isRefusal(result.error)).toBe(true);
    expect(String(result.error.message)).toContain('172.18.0.3');
  });
});
