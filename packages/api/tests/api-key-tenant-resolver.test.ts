import { describe, expect, it } from 'vitest';
import { TenantRecord } from '@fromcode119/core';
import { ApiKeyTenantResolver } from '@api/services/request/api-key-tenant-resolver';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';

const acme = TenantRecord.from({ id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["www.acme.test"]', state: 'active' });
const globex = TenantRecord.from({ id: 'globex', slug: 'globex', primary_host: 'globex.test', host_aliases: '[]', state: 'active' });
const tenants = {
  resolveById: async (id: string) => [acme, globex].find((t) => t.id === id) ?? null,
  resolveByHost: async (host: string) => [acme, globex].find((t) => t.primaryHost === host) ?? null,
};
const record = (tenantId: string | null, expiresAt: string | null = null) => new McpTokenRecord('t1', 1, 'x', undefined, expiresAt, tenantId, false);
const resolver = (found: McpTokenRecord | null) => new ApiKeyTenantResolver({ find: async () => found } as any, tenants);
const req = (headers: Record<string, string>) => ({ headers } as any);

describe('ApiKeyTenantResolver', () => {
  it('has no key when the header is missing or blank', () => {
    expect(ApiKeyTenantResolver.hasKey(req({}))).toBe(false);
    expect(ApiKeyTenantResolver.hasKey(req({ 'x-api-key': '  ' }))).toBe(false);
    expect(ApiKeyTenantResolver.hasKey(req({ 'x-api-key': 'k' }))).toBe(true);
  });

  it('a site-bound token acts on its site — no header needed, Host and Origin ignored', async () => {
    const request = req({ 'x-api-key': 'k', host: 'api.test', origin: 'http://globex.test' });
    const result = await resolver(record('acme')).resolve(request);
    expect(result.tenant?.id).toBe('acme');
    expect(request.apiToken).toBeInstanceOf(McpTokenRecord);
  });

  it('a site-bound token with a header naming ANOTHER site is refused, not redirected', async () => {
    expect(await resolver(record('acme')).resolve(req({ 'x-api-key': 'k', 'x-fc-site': 'globex' }))).toEqual({ tenant: null, reason: 'site_mismatch' });
  });

  it('a site-bound token may name its own site by id, slug, host or alias', async () => {
    for (const name of ['acme', 'ACME', 'acme.test', 'www.acme.test']) {
      expect((await resolver(record('acme')).resolve(req({ 'x-api-key': 'k', 'x-fc-site': name }))).tenant?.id).toBe('acme');
    }
  });

  it('an all-sites token must name a site', async () => {
    expect(await resolver(record(null)).resolve(req({ 'x-api-key': 'k' }))).toEqual({ tenant: null, reason: 'site_required' });
    expect((await resolver(record(null)).resolve(req({ 'x-api-key': 'k', 'x-fc-site': 'globex' }))).tenant?.id).toBe('globex');
    expect((await resolver(record(null)).resolve(req({ 'x-api-key': 'k', 'x-fc-site': 'globex.test' }))).tenant?.id).toBe('globex');
    expect(await resolver(record(null)).resolve(req({ 'x-api-key': 'k', 'x-fc-site': 'nobody' }))).toEqual({ tenant: null, reason: 'unknown_site' });
  });

  it('an unknown or expired key names no site', async () => {
    expect(await resolver(null).resolve(req({ 'x-api-key': 'k' }))).toEqual({ tenant: null, reason: 'invalid_token' });
    expect(await resolver(record('acme', '2000-01-01T00:00:00.000Z')).resolve(req({ 'x-api-key': 'k' }))).toEqual({ tenant: null, reason: 'invalid_token' });
  });
});
