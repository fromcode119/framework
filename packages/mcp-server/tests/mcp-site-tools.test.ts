import { describe, expect, it, vi } from 'vitest';
import { McpHttpClient } from '@mcp-server/mcp-http-client';
import { McpSiteTools } from '@mcp-server/mcp-site-tools';

const sites = [{ id: 'acme', slug: 'acme', host: 'acme.test' }, { id: 'globex', slug: 'globex', host: 'globex.test' }];
const fetchSites = vi.fn(async () => ({ ok: true, json: async () => ({ multiTenant: true, allSites: true, current: null, sites }) }));
const build = () => {
  const client = new McpHttpClient('https://example.test/api/v1', 'secret', fetchSites as any);
  return { client, tools: new McpSiteTools(client) };
};

describe('McpSiteTools', () => {
  it('exposes exactly the two local tools and recognises their names', () => {
    const { tools } = build();
    expect(tools.definitions().map((t) => t.name)).toEqual(['sites.list', 'sites.select']);
    expect(tools.handles('sites.select')).toBe(true);
    expect(tools.handles('content.list')).toBe(false);
  });

  it('lists the reachable sites with the current selection', async () => {
    const { tools } = build();
    expect(await tools.call('sites.list', {})).toMatchObject({ ok: true, output: { selected: null, sites }, changed: false });
  });

  it('selects a site by id, slug or host and reports whether the selection changed', async () => {
    const { client, tools } = build();
    expect(await tools.call('sites.select', { site: 'globex.test' })).toMatchObject({ ok: true, output: { selected: 'globex' }, changed: true });
    expect(client.site).toBe('globex');
    expect(await tools.call('sites.select', { site: 'GLOBEX' })).toMatchObject({ ok: true, changed: false });
    expect(await tools.call('sites.select', { site: 'acme' })).toMatchObject({ ok: true, output: { selected: 'acme' }, changed: true });
  });

  it('refuses an unknown site and a missing one, naming what IS reachable', async () => {
    const { client, tools } = build();
    expect(await tools.call('sites.select', { site: 'nobody' })).toMatchObject({ ok: false, changed: false });
    expect((await tools.call('sites.select', { site: 'nobody' })).error).toContain('acme, globex');
    expect(await tools.call('sites.select', {})).toMatchObject({ ok: false });
    expect(client.site).toBeNull();
  });
});
