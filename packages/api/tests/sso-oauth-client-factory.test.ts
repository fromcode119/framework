import { describe, expect, it, vi } from 'vitest';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoOauthClientFactory } from '@api/controllers/auth/sso/sso-oauth-client-factory';

/**
 * The sign-in clients are built from the registry's RUNTIME resolution (secrets decrypted), never from
 * the admin's masked view. Built from the masked view, the client sent "••••" as its secret and every
 * code exchange was refused.
 */
const manager = (resolved: any[]) => ({
  integrations: {
    resolveMany: vi.fn(async () => resolved),
    getConfig: vi.fn(async () => { throw new Error('the admin view must not be read'); }),
  },
}) as any;

describe('SsoOauthClientFactory', () => {
  it('offers configured providers with their decrypted config, naming a generic OpenID provider by its entry', async () => {
    const available = await new SsoOauthClientFactory(manager([
      { providerKey: 'google', config: { clientId: 'g', clientSecret: 'real-secret' } },
      { providerKey: 'openid', name: 'Company ID', config: { clientId: 'o', clientSecret: 's', authorizeUrl: 'https://id.example/a', tokenUrl: 'https://id.example/t' } },
    ])).available();
    expect(available.map((item) => [item.provider.value, item.label])).toEqual([['google', 'Google'], ['openid', 'Company ID']]);
  });

  it('leaves out a provider that is switched on but has no secret', async () => {
    const available = await new SsoOauthClientFactory(manager([{ providerKey: 'github', config: { clientId: 'x' } }])).available();
    expect(available).toEqual([]);
  });

  it('finds the client for one provider', async () => {
    const factory = new SsoOauthClientFactory(manager([{ providerKey: 'microsoft', config: { clientId: 'm', clientSecret: 's' } }]));
    expect(await factory.forProvider(SsoOauthProvider.MICROSOFT)).not.toBeNull();
    expect(await factory.forProvider(SsoOauthProvider.GOOGLE)).toBeNull();
  });
});
