import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEntrySeeder } from '@core/integrations/integration-entry-seeder';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import { IntegrationsContextProxy } from '@core/plugin/context/integrations';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * A plugin used to put its starting integration entry into the framework's own storage key by hand, because
 * the save path refuses an entry with an empty required field. `ensureEntry` is that write done once: create if
 * missing, never touch what exists, keep entries whose plugin is off, encrypt secrets like an admin save, and write
 * only when a site is bound.
 */
describe('IntegrationEntrySeeder', () => {
  const KEY = 'integration_shipping_provider_providers';

  const setup = (over: { platformOnly?: boolean } = {}) => {
    const rows = new Map<string, any>();
    const db = { async findOne(_t: string, q: { key: string }) { return rows.get(q.key) || null; } };
    const courier = {
      key: 'courier', label: 'Courier', namespace: 'org.fromcode', create: () => ({}),
      fields: [{ name: 'username', label: 'User', type: 'text', required: true }, { name: 'password', label: 'Password', type: 'password', required: true }],
    };
    const types = new Map<string, any>([['shipping_provider', {
      definition: { key: 'shipping_provider', label: 'Shipping', defaultProvider: '', platformOnly: over.platformOnly, providers: [courier] },
      providers: new Map([['courier', courier]]),
    }]]);
    const profileService = {
      normalize: (v: string) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      getProvidersSettingKey: (t: string) => `integration_${t}_providers`,
      safeParseJson: (v: string, f: any) => { try { return JSON.parse(v); } catch { return f; } },
      async upsertMeta(entry: any) { rows.set(entry.key, entry); },
    };
    const stored = new IntegrationStoredProviderService(db, { warn() {} } as any, types, profileService as any);
    const seeder = new IntegrationEntrySeeder(db, types, profileService as any, stored);
    const list = () => JSON.parse(rows.get(KEY)?.value || '{"providers":[]}').providers as any[];
    return { rows, seeder, list };
  };

  beforeEach(() => {
    process.env.INTEGRATION_SECRET_KEY = 'test-key-for-entry-seeder-0123456789abcdef';
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('site-a');
  });
  afterEach(() => vi.restoreAllMocks());

  it('creates a starting entry with empty required fields — the case the admin save refuses', async () => {
    const { seeder, list } = setup();
    expect(await seeder.ensure('shipping_provider', { id: 'courier-default', providerKey: 'courier', config: { username: '', password: '', language: 'bg' } }))
      .toEqual({ created: true, id: 'courier-default' });
    expect(list()).toHaveLength(1);
    expect(list()[0]).toMatchObject({ id: 'courier-default', name: 'Courier', providerKey: 'courier', namespace: 'org.fromcode', enabled: true });
    expect(list()[0].config).toMatchObject({ username: '', password: '', language: 'bg' });
  });

  it('never replaces or edits: the same id, or any entry of the same provider, wins', async () => {
    const { seeder, list } = setup();
    await seeder.ensure('shipping_provider', { id: 'courier-default', providerKey: 'courier', config: { username: 'a' } });
    const before = JSON.stringify(list());
    expect(await seeder.ensure('shipping_provider', { id: 'courier-default', providerKey: 'courier', config: { username: 'b' } })).toEqual({ created: false, id: 'courier-default' });
    expect(await seeder.ensure('shipping_provider', { id: 'another', providerKey: 'courier', config: { username: 'c' } })).toEqual({ created: false, id: 'courier-default' });
    expect(JSON.stringify(list())).toBe(before);
  });

  it('keeps a stored entry whose provider is not registered right now', async () => {
    const { rows, seeder, list } = setup();
    rows.set(KEY, { key: KEY, value: JSON.stringify({ providers: [{ id: 'ghost-1', providerKey: 'ghost', config: { token: 'x' }, enabled: true }] }) });
    await seeder.ensure('shipping_provider', { id: 'courier-default', providerKey: 'courier' });
    expect(list().map((entry) => entry.id)).toEqual(['ghost-1', 'courier-default']);
    expect(list()[0].config).toEqual({ token: 'x' });
  });

  it('encrypts secret fields the way an admin save does, and leaves blank ones blank', async () => {
    const { seeder, list } = setup();
    await seeder.ensure('shipping_provider', { providerKey: 'courier', config: { username: 'u', password: 'secret-value' } });
    expect(list()[0].id).toBe('courier-default');
    expect(list()[0].config.username).toBe('u');
    expect(String(list()[0].config.password)).toMatch(/^enc:v1:/);
    expect(String(list()[0].config.password)).not.toContain('secret-value');
  });

  it('writes nothing when a multi-site deployment has no site selected, unless the type is platform-wide', async () => {
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);
    const perSite = setup();
    expect(await perSite.seeder.ensure('shipping_provider', { providerKey: 'courier' })).toEqual({ created: false, id: '', reason: 'no_site' });
    expect(perSite.rows.size).toBe(0);
    const platformWide = setup({ platformOnly: true });
    expect((await platformWide.seeder.ensure('shipping_provider', { providerKey: 'courier' })).created).toBe(true);
  });

  it('writes with no site on a single-site deployment', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);
    const { seeder } = setup();
    expect((await seeder.ensure('shipping_provider', { providerKey: 'courier' })).created).toBe(true);
  });

  it('refuses a type or provider nobody registered', async () => {
    const { seeder } = setup();
    await expect(seeder.ensure('nope', { providerKey: 'courier' })).rejects.toThrow(/not registered/);
    await expect(seeder.ensure('shipping_provider', { providerKey: 'missing' })).rejects.toThrow(/not registered/);
  });
});

describe('a plugin calling ensureEntry', () => {
  const proxy = (capabilities: string[]) => {
    const violations: string[] = [];
    const ensure = vi.fn(async () => ({ created: true, id: 'x' }));
    const security = { hasCapability: (c: string) => capabilities.includes(c), handleViolation: (c: string) => { violations.push(c); } };
    const manager = { integrations: { entrySeeder: { ensure } } };
    return { api: IntegrationsContextProxy.createIntegrationsProxy({ manifest: { slug: 'p', namespace: 'org.fromcode' } } as any, manager as any, security as any), violations, ensure };
  };

  it('needs the integration capability, like reading or building the type\'s clients', async () => {
    const denied = proxy([]);
    await denied.api.ensureEntry('shipping_provider', { providerKey: 'courier' });
    expect(denied.violations).toEqual(['integration:shipping_provider']);
  });

  it.each(['integration:shipping_provider', 'integrations'])('is allowed with %s and reaches the seeder', async (capability) => {
    const allowed = proxy([capability]);
    await allowed.api.ensureEntry('shipping_provider', { id: 'a', providerKey: 'courier' });
    expect(allowed.violations).toEqual([]);
    expect(allowed.ensure).toHaveBeenCalledWith('shipping_provider', { id: 'a', providerKey: 'courier' });
  });
});
