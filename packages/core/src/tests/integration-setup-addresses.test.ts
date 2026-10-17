import { describe, expect, it } from 'vitest';
import { IntegrationRegistry } from '@core/integrations/integration-registry';
import { SsoIntegrationDefinition } from '@core/integrations/providers/sso-provider';

/**
 * The admin reads providers from the type LIST, the single-type summary from getConfig. Both must carry
 * the setup addresses, or the redirect URI an operator has to register with the provider never shows.
 */
describe('integration setup addresses', () => {
  const registry = new IntegrationRegistry({});
  registry.registerType(SsoIntegrationDefinition.definition);

  it('each SSO provider declares its redirect URI', () => {
    const summary = registry.getTypeSummary('sso');
    const google = summary?.providers.find((provider) => provider.key === 'google');
    expect(google?.setupAddresses).toEqual([expect.objectContaining({ path: '/api/auth/sso/google/callback' })]);
  });

  it('the type list the admin reads carries them too', () => {
    const sso = registry.listTypes().find((type) => type.key === 'sso');
    expect(sso?.providers.find((provider) => provider.key === 'github')?.setupAddresses?.[0]?.path).toBe('/api/auth/sso/github/callback');
  });

  it('keeps several sign-in providers switched on at once', () => {
    expect(SsoIntegrationDefinition.definition.allowMultipleActiveProviders).toBe(true);
  });

  it('Sign in with Apple is token-only: a bundle ID and app IDs, no secret and no redirect address', () => {
    const apple = registry.getTypeSummary('sso')?.providers.find((provider) => provider.key === 'apple');
    expect(apple?.fields.map((field) => field.name)).toEqual(['clientId', 'appClientIds']);
    expect(apple?.setupAddresses ?? []).toEqual([]);
  });

  it('Google also lists the client IDs of the mobile apps that sign in with it', () => {
    const google = registry.getTypeSummary('sso')?.providers.find((provider) => provider.key === 'google');
    expect(google?.fields.map((field) => field.name)).toContain('appClientIds');
  });
});
