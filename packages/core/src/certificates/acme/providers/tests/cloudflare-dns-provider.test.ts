import { describe, expect, it, vi } from 'vitest';
import { CloudflareDnsProvider } from '@core/certificates/acme/providers/cloudflare-dns-provider';

/**
 * The Cloudflare DNS-01 provider, entirely against a mocked HTTP layer — no live network call, ever.
 *
 * The three things Phase 1 explicitly asked to be proven: a record is created with the right
 * name/value, cleanup deletes ONLY the record id this provider created (never a lookup by name), and
 * propagation is actually polled — not assumed — before the challenge-create call returns.
 */
describe('CloudflareDnsProvider', () => {
  const jsonResponse = (body: unknown, ok = true, status = 200): Response => ({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);

  const instantResolver = (answers: Record<string, string[][]>) =>
    (_server: string) => ({
      resolveTxt: async (name: string) => {
        const found = answers[name];
        if (!found) throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
        return found;
      },
    });

  it('creates the TXT record with the exact name and value, via POST (never upsert)', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      if (url.endsWith('/dns_records')) return jsonResponse({ success: true, result: { id: 'record-1' } });
      throw new Error(`unexpected request: ${url}`);
    });

    const provider = new CloudflareDnsProvider(
      'test-token',
      fetchImpl as any,
      instantResolver({ '_acme-challenge.example.test': [['the-expected-value']] }),
      async () => {},
    );

    const created = await provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'the-expected-value');

    expect(created).toEqual({ zoneId: 'zone-1', recordId: 'record-1' });

    const createCall = calls.find((call) => call.url.endsWith('/dns_records'));
    expect(createCall?.init.method).toBe('POST');
    const body = JSON.parse(createCall!.init.body);
    expect(body).toEqual({ type: 'TXT', name: '_acme-challenge.example.test', content: 'the-expected-value', ttl: 120 });

    // The token is sent as a bearer credential and never appears in the URL or body.
    expect(createCall?.init.headers.Authorization).toBe('Bearer test-token');
    expect(createCall?.url).not.toContain('test-token');
  });

  it('deletes ONLY the specific record id it created — never a lookup by name', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return jsonResponse({ success: true, result: {} });
    });

    const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
    await provider.removeChallengeRecord({ zoneId: 'zone-1', recordId: 'record-1' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/zones/zone-1/dns_records/record-1');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('polls until the value is visible on EVERY configured public resolver before returning', async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      return jsonResponse({ success: true, result: { id: 'record-1' } });
    });

    // Resolver answers "not there yet" for the first two polls, then succeeds.
    const resolverFactory = (_server: string) => ({
      resolveTxt: async (_name: string) => {
        attempt += 1;
        if (attempt < 5) throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
        return [['the-value']];
      },
    });

    const sleeps: number[] = [];
    const provider = new CloudflareDnsProvider(
      'test-token',
      fetchImpl as any,
      resolverFactory,
      async (ms: number) => { sleeps.push(ms); },
    );

    const created = await provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'the-value');

    expect(created.recordId).toBe('record-1');
    // Two resolvers are asked per round, so several rounds had to run — this is the propagation poll.
    expect(attempt).toBeGreaterThan(2);
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it('gives up and throws once the propagation timeout is reached', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      return jsonResponse({ success: true, result: { id: 'record-1' } });
    });

    // Never resolves the value.
    const resolverFactory = () => ({ resolveTxt: async () => { throw new Error('ENODATA'); } });

    // Fake clock: sleeps advance a counter past the timeout instead of really waiting.
    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const provider = new CloudflareDnsProvider(
        'test-token',
        fetchImpl as any,
        resolverFactory,
        async () => { now += 200_000; },
      );

      await expect(provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'the-value'))
        .rejects.toThrow(/did not become visible/);
    } finally {
      Date.now = originalNow;
    }
  });

  it('deletes the just-created record when propagation fails, so nothing is orphaned in the zone', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      if (init?.method === 'POST' && url.endsWith('/dns_records')) return jsonResponse({ success: true, result: { id: 'record-1' } });
      if (init?.method === 'DELETE') return jsonResponse({ success: true, result: {} });
      throw new Error(`unexpected request: ${url}`);
    });

    // Never resolves the value — propagation always fails.
    const resolverFactory = () => ({ resolveTxt: async () => { throw new Error('ENODATA'); } });

    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const provider = new CloudflareDnsProvider(
        'test-token',
        fetchImpl as any,
        resolverFactory,
        async () => { now += 200_000; },
      );

      await expect(provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'the-value'))
        .rejects.toThrow(/did not become visible/);
    } finally {
      Date.now = originalNow;
    }

    const deleteCall = calls.find((call) => call.init?.method === 'DELETE');
    expect(deleteCall?.url).toBe('https://api.cloudflare.com/client/v4/zones/zone-1/dns_records/record-1');
  });

  it('still throws the original propagation error even when the cleanup delete itself fails', async () => {
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      if (init?.method === 'POST' && url.endsWith('/dns_records')) return jsonResponse({ success: true, result: { id: 'record-1' } });
      if (init?.method === 'DELETE') throw new Error('network down');
      throw new Error(`unexpected request: ${url}`);
    });

    const resolverFactory = () => ({ resolveTxt: async () => { throw new Error('ENODATA'); } });

    let now = 0;
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      const provider = new CloudflareDnsProvider(
        'test-token',
        fetchImpl as any,
        resolverFactory,
        async () => { now += 200_000; },
      );

      // The cleanup failure must not mask the real reason the order failed.
      await expect(provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'the-value'))
        .rejects.toThrow(/did not become visible/);
    } finally {
      Date.now = originalNow;
    }
  });

  it('refuses when the zone is not visible to this token', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/zones?name=')) return jsonResponse({ success: true, result: [] });
      throw new Error('should not reach dns_records without a zone');
    });

    const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
    await expect(provider.createChallengeRecord('example.test', '_acme-challenge.example.test', 'value'))
      .rejects.toThrow(/was not found, or this token cannot see it/);
  });

  it('canManageZone answers true only when the zone lookup returns a result', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('name=has-zone.test')) return jsonResponse({ success: true, result: [{ id: 'zone-1' }] });
      return jsonResponse({ success: true, result: [] });
    });

    const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
    expect(await provider.canManageZone('has-zone.test')).toBe(true);
    expect(await provider.canManageZone('no-zone.test')).toBe(false);
  });

  describe('zone resolution — a host is not always its own Cloudflare zone', () => {
    it('resolves a subdomain host to its parent zone (console.fromcode.com -> fromcode.com)', async () => {
      const queried: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        const match = /name=([^&]+)/.exec(url);
        const name = match ? decodeURIComponent(match[1]) : '';
        queried.push(name);
        // Only the registrable zone itself is a real Cloudflare zone — the subdomain never is.
        if (name === 'fromcode.com') return jsonResponse({ success: true, result: [{ id: 'zone-fromcode' }] });
        return jsonResponse({ success: true, result: [] });
      });

      const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
      expect(await provider.canManageZone('console.fromcode.com')).toBe(true);

      // It must have tried the full host first (exact match still wins) before walking up.
      expect(queried).toEqual(['console.fromcode.com', 'fromcode.com']);
    });

    it('uses the resolved parent zone id for both the TXT record and the record it returns', async () => {
      const calls: Array<{ url: string; init: any }> = [];
      const fetchImpl = vi.fn(async (url: string, init: any) => {
        calls.push({ url, init });
        if (url.includes('name=admin.fromcode.com')) return jsonResponse({ success: true, result: [] });
        if (url.includes('name=fromcode.com')) return jsonResponse({ success: true, result: [{ id: 'zone-fromcode' }] });
        if (init?.method === 'POST' && url.endsWith('/dns_records')) return jsonResponse({ success: true, result: { id: 'record-1' } });
        throw new Error(`unexpected request: ${url}`);
      });

      const provider = new CloudflareDnsProvider(
        'test-token',
        fetchImpl as any,
        () => ({ resolveTxt: async () => [['the-value']] }),
        async () => {},
      );

      const created = await provider.createChallengeRecord('admin.fromcode.com', '_acme-challenge.admin.fromcode.com', 'the-value');
      expect(created).toEqual({ zoneId: 'zone-fromcode', recordId: 'record-1' });

      const createCall = calls.find((call) => call.init?.method === 'POST' && call.url.endsWith('/dns_records'));
      expect(createCall?.url).toBe('https://api.cloudflare.com/client/v4/zones/zone-fromcode/dns_records');
    });

    it('fails cleanly, with a clear reason, when the token cannot see the zone at any level', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ success: true, result: [] }));

      const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
      expect(await provider.canManageZone('sub.unmanaged.example')).toBe(false);

      await expect(
        provider.createChallengeRecord('sub.unmanaged.example', '_acme-challenge.sub.unmanaged.example', 'value'),
      ).rejects.toThrow(/was not found, or this token cannot see it/);
    });

    it('never tries the bare TLD as a candidate zone', async () => {
      const queried: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        const match = /name=([^&]+)/.exec(url);
        queried.push(match ? decodeURIComponent(match[1]) : '');
        return jsonResponse({ success: true, result: [] });
      });

      const provider = new CloudflareDnsProvider('test-token', fetchImpl as any);
      await provider.canManageZone('admin.fromcode.com');

      expect(queried).toEqual(['admin.fromcode.com', 'fromcode.com']);
      expect(queried).not.toContain('com');
    });
  });

  it('surfaces Cloudflare\'s own error message on a failed API call', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, errors: [{ message: 'Invalid API token' }] }, false, 403));
    const provider = new CloudflareDnsProvider('bad-token', fetchImpl as any);
    await expect(provider.canManageZone('example.test')).rejects.toThrow('Invalid API token');
  });
});
