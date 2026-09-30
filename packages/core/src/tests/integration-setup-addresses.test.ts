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
    expect(google?.setupAddresses).toEqual([expect.objectContaining({ path: '/api/v1/auth/sso/google/callback' })]);
  });

  it('the type list the admin reads carries them too', () => {
    const sso = registry.listTypes().find((type) => type.key === 'sso');
    expect(sso?.providers.find((provider) => provider.key === 'github')?.setupAddresses?.[0]?.path).toBe('/api/v1/auth/sso/github/callback');
  });
});
