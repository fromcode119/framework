import { PluginManager } from '@fromcode119/core';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoOauthClient } from '@api/controllers/auth/sso/sso-oauth-client';

/**
 * The redirect sign-in clients this site's Federated Login settings make possible.
 *
 * A provider is offered only when it is switched on AND has the client ID and secret the redirect
 * needs, so the storefront never shows a button that cannot work. Secrets are decrypted by the
 * integration registry (`instantiateWithConfig`), never here.
 */
export class SsoOauthClientFactory {
  private static readonly TYPE = 'sso';

  constructor(private readonly manager: PluginManager) {}

  /** Every provider a visitor can sign in with right now, in the order the operator arranged them. */
  async available(): Promise<Array<{ provider: SsoOauthProvider; label: string; client: SsoOauthClient }>> {
    const found: Array<{ provider: SsoOauthProvider; label: string; client: SsoOauthClient }> = [];
    for (const entry of await this.enabledEntries()) {
      const provider = SsoOauthProvider.resolve(entry.providerKey);
      if (!provider || found.some((item) => item.provider === provider)) continue;
      const client = await this.clientFor(provider, entry.config);
      if (!client.configured) continue;
      // A generic OpenID provider is named by the operator (the entry's name); the others by their brand.
      const label = provider === SsoOauthProvider.OPENID ? String(entry.name || '').trim() || provider.label : provider.label;
      found.push({ provider, label, client });
    }
    return found;
  }

  async forProvider(provider: SsoOauthProvider): Promise<SsoOauthClient | null> {
    return (await this.available()).find((item) => item.provider === provider)?.client ?? null;
  }

  private async enabledEntries(): Promise<Array<{ providerKey: string; name?: string; config: Record<string, any> | null }>> {
    const integration: any = await this.manager.integrations.getConfig(SsoOauthClientFactory.TYPE).catch(() => null);
    const stored = Array.isArray(integration?.storedProviders) ? integration.storedProviders : [];
    const enabled = stored
      .filter((entry: any) => entry && entry.enabled !== false)
      .map((entry: any) => ({ providerKey: String(entry.providerKey || '').trim().toLowerCase(), name: entry.name, config: entry.config || {} }));
    if (enabled.length) return enabled;
    // Configured from the environment (GOOGLE_CLIENT_ID, …): the registry resolves that one provider.
    const active = String(integration?.active?.provider || '').trim().toLowerCase();
    return active ? [{ providerKey: active, config: null }] : [];
  }

  /** `config: null` means the environment-resolved provider; a stored config is decrypted by the registry. */
  private async clientFor(provider: SsoOauthProvider, config: Record<string, any> | null): Promise<SsoOauthClient> {
    try {
      const resolved = config === null
        ? await this.manager.integrations.get(SsoOauthClientFactory.TYPE)
        : (await this.manager.integrations.instantiateWithConfig(SsoOauthClientFactory.TYPE, provider.value, config)).instance;
      return new SsoOauthClient(provider, resolved || {});
    } catch {
      // A required field is missing: the provider is switched on but not usable, so it is not offered.
      return new SsoOauthClient(provider, {});
    }
  }
}
