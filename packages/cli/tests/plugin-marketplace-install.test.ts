import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunningPlatformApi } from '@cli/services/running-platform-api';
import { PluginMarketplaceInstall } from '@cli/services/plugin-marketplace-install';

type Call = { method: string; url: string; key: string | null };

describe('plugin install/update from a terminal goes through the running platform', () => {
  const calls: Call[] = [];
  let routes: Record<string, (call: Call) => { status?: number; body: unknown }>;

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv(RunningPlatformApi.KEY_ENV, 'fc_test_token');
    vi.stubEnv(RunningPlatformApi.URL_ENV, '');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const call = { method: String(init?.method || 'GET'), url, key: headers['x-api-key'] ?? null };
      calls.push(call);
      const path = new URL(url).pathname + new URL(url).search;
      const route = Object.keys(routes).find((pattern) => path.endsWith(pattern));
      const answer = route ? routes[route](call) : { status: 404, body: { error: 'no route' } };
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('starts the admin install operation with the API token and follows it to completion', async () => {
    let polls = 0;
    routes = {
      '/plugins/install/sample-shop?version=0.1.396': () => ({ status: 202, body: { success: true, operationId: 'op-1', dependencies: [] } }),
      '/plugins/install-operations/op-1': () => {
        polls += 1;
        return { body: { operation: { status: polls < 3 ? 'running' : 'completed', phase: polls < 3 ? 'installing' : 'done', message: '' } } };
      },
    };
    const lines: string[] = [];
    const operation = await new PluginMarketplaceInstall(RunningPlatformApi.connect(), async () => undefined).run('sample-shop', '0.1.396', (line) => lines.push(line));

    expect(operation.status).toBe('completed');
    expect(polls).toBe(3);
    expect(calls[0]).toMatchObject({ method: 'POST', key: 'fc_test_token' });
    expect(calls[0].url.startsWith('http://localhost:3000/')).toBe(true);
    expect(calls.every((call) => call.key === 'fc_test_token')).toBe(true);
    expect(lines).toEqual(['installing', 'done']);
  });

  it('reports the failure the platform recorded', async () => {
    routes = {
      '/plugins/install/sample-shop': () => ({ status: 202, body: { operationId: 'op-2' } }),
      '/plugins/install-operations/op-2': () => ({ body: { operation: { status: 'failed', error: 'checksum mismatch' } } }),
    };
    await expect(new PluginMarketplaceInstall(RunningPlatformApi.connect(), async () => undefined).run('sample-shop', undefined, () => undefined))
      .rejects.toThrow('checksum mismatch');
  });

  it('passes on a refusal from the platform, such as a token that is not a platform admin', async () => {
    routes = { '/plugins/install/sample-shop': () => ({ status: 403, body: { error: 'platform_admin_required', message: 'only a platform admin may do that' } }) };
    await expect(new PluginMarketplaceInstall(RunningPlatformApi.connect('https://console.example.test/'), async () => undefined).run('sample-shop', undefined, () => undefined))
      .rejects.toThrow(/403: only a platform admin may do that/);
    expect(calls[0].url.startsWith('https://console.example.test/')).toBe(true);
  });

  it('refuses to run without an API token instead of falling back to writing the plugin folder', () => {
    vi.stubEnv(RunningPlatformApi.KEY_ENV, '');
    expect(() => RunningPlatformApi.connect()).toThrow(RunningPlatformApi.KEY_ENV);
  });

  it('lists only the installed plugins the marketplace has a newer version of', async () => {
    routes = {
      '/marketplace/plugins': () => ({ body: { plugins: [{ slug: 'sample-shop', version: '0.1.396' }, { slug: 'sample-books', version: '0.1.147' }] } }),
      '/plugins': () => ({ body: [{ manifest: { slug: 'sample-shop', version: '0.1.395' } }, { manifest: { slug: 'sample-books', version: '0.1.147' } }] }),
    };
    const installer = new PluginMarketplaceInstall(RunningPlatformApi.connect(), async () => undefined);
    expect(await installer.outdated()).toEqual([{ slug: 'sample-shop', current: '0.1.395', latest: '0.1.396' }]);
    expect(await installer.installedVersion('sample-books')).toBe('0.1.147');
  });
});
