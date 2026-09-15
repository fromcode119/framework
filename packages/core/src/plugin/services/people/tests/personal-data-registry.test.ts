import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalDataRegistry } from '@core/plugin/services/people/personal-data-registry';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * These moved here with the registry itself. They used to live in a plugin, which is
 * exactly the problem: a descriptor being valid, and a dataset being reachable by an erasure, is a
 * property of the platform — not of whether a compliance product happens to be installed.
 */
describe('PersonalDataRegistry', () => {
  beforeEach(() => PersonalDataRegistry.clear());

  const invoke = { exportSubject: async () => [], eraseSubject: async () => ({}) };
  const source = (over: Record<string, unknown> = {}) => ({
    namespace: 'example.vendor', pluginSlug: 'alpha', key: 'records', label: 'Alpha records',
    fields: ['email'], strategies: ['anonymise', 'retain'], defaultStrategy: 'anonymise',
    methods: { export: 'exportPersonalData', erase: 'erasePersonalData' },
    ...over,
  }) as any;

  it('accepts a descriptor and keeps the callbacks the framework built', () => {
    expect(PersonalDataRegistry.register(source(), invoke)).toBe(true);
    const [entry] = PersonalDataRegistry.list();
    expect(typeof entry.invoke.eraseSubject).toBe('function');
  });

  it('refuses a default that is not in the declared set', () => {
    // Otherwise an operator is shown a fallback they can never select.
    expect(PersonalDataRegistry.register(source({ defaultStrategy: 'delete' }), invoke)).toBe(false);
  });

  it('drops strategies this platform cannot actually run', () => {
    PersonalDataRegistry.register(source({ strategies: ['anonymise', 'shred', 'retain'] }), invoke);
    expect(PersonalDataRegistry.list()[0].strategies).toEqual(['anonymise', 'retain']);
  });

  it('refuses a descriptor with no plugin or key to be addressed by', () => {
    expect(PersonalDataRegistry.register(source({ key: '' }), invoke)).toBe(false);
    expect(PersonalDataRegistry.list()).toHaveLength(0);
  });

  it('is idempotent per plugin:key, so a re-register updates rather than duplicates', () => {
    PersonalDataRegistry.register(source(), invoke);
    PersonalDataRegistry.register(source({ label: 'Renamed' }), invoke);
    expect(PersonalDataRegistry.list()).toHaveLength(1);
    expect(PersonalDataRegistry.list()[0].label).toBe('Renamed');
  });

  it('removes every dataset a plugin declared when that plugin goes away', () => {
    PersonalDataRegistry.register(source(), invoke);
    PersonalDataRegistry.register(source({ key: 'carts' }), invoke);
    PersonalDataRegistry.register(source({ pluginSlug: 'beta', key: 'documents' }), invoke);

    PersonalDataRegistry.unregisterByPlugin('alpha');

    expect(PersonalDataRegistry.list().map((s) => s.pluginSlug)).toEqual(['beta']);
  });

  describe('listForCurrentTenant', () => {
    afterEach(() => vi.restoreAllMocks());

    it('narrows to the plugins the requesting site actually runs', () => {
      // The registry is process-wide — one api serves every site. Walked unfiltered, a DSAR on a site
      // that does not run a given plugin reported that plugin's dataset as a source it could not reach,
      // which makes the fulfilment report incomplete over data that was never that site's to hold.
      PersonalDataRegistry.register(source(), invoke);
      PersonalDataRegistry.register(source({ pluginSlug: 'gamma', key: 'entries' }), invoke);

      vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('fromcode');
      vi.spyOn(PluginTenantAccess, 'isEnabledForCurrentTenant').mockImplementation((slug: string) => slug === 'alpha');

      expect(PersonalDataRegistry.listForCurrentTenant().map((s) => s.pluginSlug)).toEqual(['alpha']);
    });

    it('returns everything outside a request, where there is no site to narrow to', () => {
      PersonalDataRegistry.register(source(), invoke);
      PersonalDataRegistry.register(source({ pluginSlug: 'gamma', key: 'entries' }), invoke);

      vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);

      expect(PersonalDataRegistry.listForCurrentTenant()).toHaveLength(2);
    });
  });
});
