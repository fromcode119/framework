import { describe, expect, it } from 'vitest';
import { IntegrationStoredProviderService } from './integration-stored-provider-service';

describe('IntegrationStoredProviderService', () => {
  it('keeps sibling providers enabled for integrations that allow multiple active providers', async () => {
    const rows = new Map<string, any>();
    const db = {
      async findOne(_table: string, query: { key: string }) {
        return rows.get(query.key) || null;
      },
      async insert(_table: string, entry: any) {
        rows.set(entry.key, entry);
      },
      async update(_table: string, query: { key: string }, entry: any) {
        rows.set(query.key, { ...(rows.get(query.key) || {}), ...entry, key: query.key });
      },
    };
    const paymentGatewayDefinition = {
      key: 'payment_gateway',
      label: 'Payment Gateway',
      defaultProvider: 'manual',
      allowMultipleActiveProviders: true,
      providers: [
        { key: 'manual', label: 'Manual', fields: [], create: () => ({ type: 'manual' }) },
        { key: 'stripe', label: 'Stripe', fields: [], create: () => ({ type: 'stripe' }) },
      ],
    };
    const types = new Map<string, any>();
    types.set('payment_gateway', {
      definition: paymentGatewayDefinition,
      providers: new Map(paymentGatewayDefinition.providers.map((provider) => [provider.key, provider])),
    });
    const profileService = {
      normalize(value: string) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      },
      getProvidersSettingKey(typeKey: string) {
        return `integration_${typeKey}_providers`;
      },
      safeParseJson(value: string, fallback: any) {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      },
      validateProviderConfig() {},
      async upsertMeta(entry: any) {
        rows.set(entry.key, entry);
      },
    };
    const service = new IntegrationStoredProviderService(db, { warn() {} } as any, types, profileService as any);

    rows.set('integration_payment_gateway_providers', {
      key: 'integration_payment_gateway_providers',
      value: JSON.stringify({
        providers: [
          {
            id: 'manual-primary',
            name: 'Manual',
            providerKey: 'manual',
            config: {},
            enabled: true,
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
          },
          {
            id: 'stripe-primary',
            name: 'Stripe',
            providerKey: 'stripe',
            config: {},
            enabled: true,
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
          },
        ],
      }),
    });

    await service.updateStoredConfig(
      'payment_gateway',
      'manual',
      {},
      { providerId: 'manual-primary', makeActive: true, enabled: true },
    );

    const storedProviders = await service.readStoredProvidersInternal('payment_gateway');
    expect(storedProviders?.map((provider) => ({
      id: provider.id,
      enabled: provider.enabled,
    }))).toEqual([
      { id: 'manual-primary', enabled: true },
      { id: 'stripe-primary', enabled: true },
    ]);
  });

  it('still disables sibling providers for single-active integrations', async () => {
    const rows = new Map<string, any>();
    const db = {
      async findOne(_table: string, query: { key: string }) {
        return rows.get(query.key) || null;
      },
      async insert(_table: string, entry: any) {
        rows.set(entry.key, entry);
      },
      async update(_table: string, query: { key: string }, entry: any) {
        rows.set(query.key, { ...(rows.get(query.key) || {}), ...entry, key: query.key });
      },
    };
    const storageDefinition = {
      key: 'storage',
      label: 'Storage',
      defaultProvider: 'local',
      providers: [
        { key: 'local', label: 'Local', fields: [], create: () => ({ type: 'local' }) },
        { key: 's3', label: 'S3', fields: [], create: () => ({ type: 's3' }) },
      ],
    };
    const types = new Map<string, any>();
    types.set('storage', {
      definition: storageDefinition,
      providers: new Map(storageDefinition.providers.map((provider) => [provider.key, provider])),
    });
    const profileService = {
      normalize(value: string) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      },
      getProvidersSettingKey(typeKey: string) {
        return `integration_${typeKey}_providers`;
      },
      safeParseJson(value: string, fallback: any) {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      },
      validateProviderConfig() {},
      async upsertMeta(entry: any) {
        rows.set(entry.key, entry);
      },
    };
    const service = new IntegrationStoredProviderService(db, { warn() {} } as any, types, profileService as any);

    rows.set('integration_storage_providers', {
      key: 'integration_storage_providers',
      value: JSON.stringify({
        providers: [
          {
            id: 'local-primary',
            name: 'Local',
            providerKey: 'local',
            config: {},
            enabled: true,
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
          },
          {
            id: 's3-primary',
            name: 'S3',
            providerKey: 's3',
            config: {},
            enabled: true,
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
          },
        ],
      }),
    });

    await service.updateStoredConfig(
      'storage',
      'local',
      {},
      { providerId: 'local-primary', makeActive: true, enabled: true },
    );

    const storedProviders = await service.readStoredProvidersInternal('storage');
    expect(storedProviders?.map((provider) => ({
      id: provider.id,
      enabled: provider.enabled,
    }))).toEqual([
      { id: 'local-primary', enabled: true },
      { id: 's3-primary', enabled: false },
    ]);
  });
});
