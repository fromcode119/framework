import { beforeAll, describe, expect, it } from 'vitest';
import { IntegrationMaskedSecretRestorer } from '@core/integrations/integration-masked-secret-restorer';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import { SecretService } from '@core/security/secret-service';

/**
 * A plugin reads a saved integration entry with its secrets masked, so a client built from that copy used to
 * carry the placeholder as the password and the carrier refused the login. A placeholder now means "the stored
 * secret", for the entry the plugin names.
 */
const MASK = SecretService.getSavedSecretMask();
const provider: any = { key: 'econt', label: 'Econt', registeredBy: 'logistics-econt', fields: [{ name: 'username', type: 'text' }, { name: 'password', type: 'password' }] };

describe('a masked secret handed back for a saved provider', () => {
  let sealedA = '';
  let sealedB = '';
  beforeAll(() => {
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-for-the-restorer';
    sealedA = SecretService.encrypt('password-of-account-a');
    sealedB = SecretService.encrypt('password-of-account-b');
  });

  const entries = (): any[] => [
    { id: 'econt-default', providerKey: 'econt', enabled: true, registeredBy: 'logistics-econt', config: { username: 'a@example.com', password: sealedA } },
    { id: 'econt-second', providerKey: 'econt', enabled: false, registeredBy: 'logistics-econt', config: { username: 'b@example.com', password: sealedB } },
  ];
  const stored = (list: any[]) => ({ readStoredProvidersInternal: async () => list }) as unknown as IntegrationStoredProviderService;
  const masked = (username: string) => ({ username, password: MASK });
  const restore = (list: any[], config: Record<string, any>, providerId?: string, p: any = provider) => IntegrationMaskedSecretRestorer.restore(stored(list), 'shipping_provider', 'econt', p, config, providerId);

  it('is the named entry\'s own stored secret, so a second account is not mixed up with the first', async () => {
    expect((await restore(entries(), masked('b@example.com'), 'econt-second')).password).toBe(sealedB);
    expect((await restore(entries(), masked('a@example.com'), 'ECONT-DEFAULT')).password).toBe(sealedA);
  });

  it('is decrypted to the real password by the framework\'s own runtime step', async () => {
    const restored = await restore(entries(), masked('b@example.com'), 'econt-second');
    const runtime = new IntegrationStoredProviderService({} as any, {} as any, new Map(), {} as any).resolveRuntimeConfig(provider, restored);
    expect(runtime.password).toBe('password-of-account-b');
  });

  it('is found without a name only when the provider has exactly one saved entry', async () => {
    expect((await restore([entries()[0]], masked('a@example.com'))).password).toBe(sealedA);
    expect((await restore(entries(), masked('a@example.com'))).password).toBe(MASK);
  });

  it('stays the placeholder for an unknown entry, and goes only to the plugin that registered the provider', async () => {
    expect((await restore(entries(), masked('a@example.com'), 'no-such-entry')).password).toBe(MASK);
    expect((await restore(entries(), masked('a@example.com'), 'econt-default', { ...provider, registeredBy: 'another-plugin' })).password).toBe(MASK);
  });

  it('leaves a config that carries a real value alone, and never touches a field that is not secret', async () => {
    const config = { username: 'a@example.com', password: 'typed-by-the-plugin' };
    expect(await restore(entries(), config, 'econt-default')).toEqual(config);
    expect((await restore(entries(), { username: MASK, password: MASK }, 'econt-default')).username).toBe(MASK);
  });
});
