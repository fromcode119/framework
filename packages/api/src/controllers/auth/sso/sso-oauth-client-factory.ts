import { PluginManager } from '@fromcode119/core';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoOauthClient } from '@api/controllers/auth/sso/sso-oauth-client';

/**
 * The redirect sign-in clients this site's Federated Login settings make possible.
 *
 * A provider is offered only when it is switched on AND has the client ID and secret the redirect
 * needs, so the storefront never shows a button that cannot work. The configs come from the registry's
 * runtime resolution, with secrets decrypted there — never from `getConfig().storedProviders`, which is
 * the admin's view and masks every secret: a client built from it sent the mask as the client secret
 * and every code exchange was refused.
 */
export class SsoOauthClientFactory {
  private static readonly TYPE = 'sso';

  constructor(private readonly manager: PluginManager) {}

  /** Every provider a visitor can sign in with right now, in the order the operator arranged them. */
  async available(): Promise<Array<{ provider: SsoOauthProvider; label: string; client: SsoOauthClient }>> {
    const resolved = await this.manager.integrations.resolveMany(SsoOauthClientFactory.TYPE).catch(() => []);
    const found: Array<{ provider: SsoOauthProvider; label: string; client: SsoOauthClient }> = [];
    for (const entry of resolved) {
      const provider = SsoOauthProvider.resolve(entry.providerKey);
      if (!provider || found.some((item) => item.provider === provider)) continue;
      const client = new SsoOauthClient(provider, entry.config || {});
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
}
