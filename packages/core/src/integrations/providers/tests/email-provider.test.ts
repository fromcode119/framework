import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import { SecretService } from '@core/security/secret-service';
import { EmailIntegrationDefinition } from '@core/integrations/providers/email-integration-definition';
import { EmailGateway } from '@core/integrations/providers/email-gateway';

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

describe('EmailGateway sender', () => {
  it('carries the configured From Address and From Name as the default sender', () => {
    expect(
      EmailGateway.normalizeSmtpConfig({ host: 'smtp.example.com', fromAddress: 'notifications@example.com', fromName: 'Shop' }).from,
    ).toBe('"Shop" <notifications@example.com>');
  });

  it('keeps the sender when an already-normalized config is normalized again', () => {
    const once = EmailGateway.normalizeSmtpConfig({ host: 'smtp.example.com', fromAddress: 'notifications@example.com', fromName: 'Shop' });
    expect(EmailGateway.normalizeSmtpConfig(once).from).toBe('"Shop" <notifications@example.com>');
  });

  it('sends through the provider as the configured From, not the Reply-To', async () => {
    const senders: string[] = [];
    const server = net.createServer((socket) => {
      let inData = false;
      socket.write('220 localhost ESMTP\r\n');
      socket.on('data', (chunk) => {
        for (const line of chunk.toString().split('\r\n').filter(Boolean)) {
          if (inData) { if (line === '.') { inData = false; socket.write('250 OK\r\n'); } continue; }
          const command = line.toUpperCase();
          if (command.startsWith('MAIL FROM')) senders.push(line.slice(10).replace(/[<>]/g, '').split(' ')[0]);
          if (command === 'DATA') { inData = true; socket.write('354 go\r\n'); }
          else if (command === 'QUIT') socket.end('221 bye\r\n');
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as net.AddressInfo).port;
      const smtp = EmailIntegrationDefinition.definition.providers?.find((provider) => provider.key === 'smtp');
      // The registry's order: normalize the stored config, then hand the result to `create`.
      const normalized = await smtp!.normalizeConfig!({ host: '127.0.0.1', port, fromAddress: 'notifications@example.com', fromName: 'Shop' });
      const email: any = await smtp!.create({ ...normalized, ignoreTLS: true });
      await email.send({ to: 'owner@example.com', subject: 'New submission', text: 'x', headers: { 'Reply-To': 'visitor@example.org' } });
      expect(senders).toEqual(['notifications@example.com']);
    } finally {
      server.close();
    }
  });

  it('sets no sender when no From Address is configured', () => {
    expect('from' in EmailGateway.normalizeSmtpConfig({ host: 'smtp.example.com', fromName: 'Shop' })).toBe(false);
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
