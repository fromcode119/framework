import { describe, expect, it } from 'vitest';
import { IntegrationStoredProviderService } from '../integration-stored-provider-service';
import { SecretService } from '../../security/secret-service';
import { EmailIntegrationDefinition } from './email-integration-definition';
import { EmailGateway } from './email-gateway';

describe('EmailGateway', () => {
  it('keeps SMTP credentials when config is already normalized with auth', () => {
    expect(
      EmailGateway.normalizeSmtpConfig({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
          user: 'mailer@example.com',
          pass: 'secret-pass',
        },
      }),
    ).toEqual({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'mailer@example.com',
        pass: 'secret-pass',
      },
    });
  });
});

describe('EmailIntegrationDefinition', () => {
  it('stores flat SMTP credentials and resolves them into auth credentials', async () => {
    const previousSecretKey = process.env.INTEGRATION_SECRET_KEY;
    process.env.INTEGRATION_SECRET_KEY = 'test-integration-secret-key';
    try {
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
      const types = new Map<string, any>();
      types.set('email', {
        definition: EmailIntegrationDefinition,
        providers: new Map(EmailIntegrationDefinition.definition.providers?.map((provider) => [provider.key, provider])),
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

      await service.updateStoredConfig(
        'email',
        'smtp',
        {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          user: 'mailer@example.com',
          pass: 'secret-pass',
        },
        { providerId: 'smtp-primary' },
      );

      const rawProviders = await service.readStoredProvidersInternal('email');
      const provider = EmailIntegrationDefinition.definition.providers?.find((entry) => entry.key === 'smtp');
      const resolvedConfig = service.resolveRuntimeConfig(provider as any, rawProviders?.[0]?.config || {});
      const normalizedConfig = provider?.normalizeConfig?.(resolvedConfig) || resolvedConfig;
      const storedProviders = await service.readStoredProvidersConfig('email');
      const storedConfig = storedProviders?.[0]?.config || {};

      expect(normalizedConfig.auth).toEqual({
        user: 'mailer@example.com',
        pass: 'secret-pass',
      });
      expect(storedConfig.user).toBe('mailer@example.com');
      expect(storedConfig.pass).toBe(SecretService.getSavedSecretMask());
    } finally {
      if (previousSecretKey === undefined) {
        delete process.env.INTEGRATION_SECRET_KEY;
      } else {
        process.env.INTEGRATION_SECRET_KEY = previousSecretKey;
      }
    }
  });
});
