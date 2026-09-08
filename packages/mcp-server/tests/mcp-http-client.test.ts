import { describe, expect, it, vi } from 'vitest';
import { McpHttpClient } from '@mcp-server/mcp-http-client';

describe('McpHttpClient', () => {
  it('sends the key in x-api-key, never as a bearer token', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tools: [{ tool: 'content.list' }] }) }));
    const client = new McpHttpClient('https://example.test/api/v1', 'secret', fetchMock as any);
    const tools = await client.listTools();

    expect(tools).toEqual([{ tool: 'content.list' }]);
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(url).toBe('https://example.test/api/v1/mcp/tools');
    expect(init.headers['x-api-key']).toBe('secret');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('posts a tool call and returns the result envelope', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, output: { items: [] } }) }));
    const client = new McpHttpClient('https://example.test/api/v1', 'secret', fetchMock as any);

    expect(await client.callTool('content.list', { collection: 'pages' }))
      .toEqual({ ok: true, output: { items: [] } });
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(JSON.parse(init.body)).toEqual({ tool: 'content.list', input: { collection: 'pages' } });
  });

  it('turns a transport failure into an error envelope rather than throwing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'nope' }) }));
    const client = new McpHttpClient('https://example.test/api/v1', 'secret', fetchMock as any);

    expect(await client.callTool('content.list', {})).toEqual({ ok: false, error: 'HTTP 403: nope' });
  });

  it('returns an empty tool list rather than throwing when listing is refused', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'no' }) }));
    expect(await new McpHttpClient('https://example.test/api/v1', 'bad', fetchMock as any).listTools()).toEqual([]);
  });

  it('strips a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tools: [] }) }));
    await new McpHttpClient('https://example.test/api/v1/', 'secret', fetchMock as any).listTools();
    expect((fetchMock.mock.calls[0] as any[])[0]).toBe('https://example.test/api/v1/mcp/tools');
  });
});

describe('McpHttpClient sites', () => {
  it('sends no site header until a site is selected, then names it on every call', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tools: [] }) }));
    const client = new McpHttpClient('https://example.test/api/v1', 'secret', fetchMock as any);
    await client.listTools();
    expect((fetchMock.mock.calls[0] as any[])[1].headers['x-fc-site']).toBeUndefined();

    client.selectSite('acme');
    await client.listTools();
    await client.callTool('content.list', {});
    expect((fetchMock.mock.calls[1] as any[])[1].headers['x-fc-site']).toBe('acme');
    expect((fetchMock.mock.calls[2] as any[])[1].headers['x-fc-site']).toBe('acme');
  });

  it('lists the sites the token reaches, and turns a refusal into an envelope', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ multiTenant: true, allSites: true, current: null, sites: [{ id: 'acme', slug: 'acme', host: 'acme.test' }] }) }));
    const sites = await new McpHttpClient('https://example.test/api/v1', 'secret', ok as any).listSites();
    expect((ok.mock.calls[0] as any[])[0]).toBe('https://example.test/api/v1/mcp/sites');
    expect(sites).toMatchObject({ ok: true, multiTenant: true, allSites: true, sites: [{ id: 'acme' }] });

    const refused = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_token' }) }));
    expect(await new McpHttpClient('https://example.test/api/v1', 'bad', refused as any).listSites()).toMatchObject({ ok: false, sites: [], error: 'HTTP 401: invalid_token' });
  });
});
