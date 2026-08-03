/**
 * Normalisation and environment discovery for SSO provider configuration.
 *
 * Split out of `SsoIntegrationDefinition` because one file holds one class; the definition is a
 * declarative descriptor, these are the behaviours it points at.
 *
 * The config is a genuinely opaque JSON blob (its keys differ per provider), so it stays a
 * `Record<string, unknown>` rather than being forced into a class with no behaviour.
 */
export class SsoProviderUtils {
  /** Every OAuth/OIDC key the SSO integration understands, trimmed and coerced to a string. */
  static normalizeSsoConfig(input: Record<string, unknown>): Record<string, unknown> {
    return {
      clientId: String(input?.clientId || '').trim(),
      clientSecret: String(input?.clientSecret || '').trim(),
      scopes: String(input?.scopes || '').trim(),
      issuer: String(input?.issuer || '').trim(),
      authorizeUrl: String(input?.authorizeUrl || '').trim(),
      tokenUrl: String(input?.tokenUrl || '').trim(),
      userInfoUrl: String(input?.userInfoUrl || '').trim(),
    };
  }

  /**
   * The provider implied by the environment, or `null` when nothing is configured.
   *
   * An explicit `SSO_PROVIDER` wins; otherwise the first provider whose client id/secret is present.
   */
  static resolveSsoFromEnv(): { provider: string; config: Record<string, unknown> } | null {
    const configured = String(process.env.SSO_PROVIDER || '').trim().toLowerCase();
    if (configured) {
      return { provider: configured, config: {} };
    }

    for (const candidate of SsoProviderUtils.envCandidates) {
      if (!process.env[candidate.idKey] && !process.env[candidate.secretKey]) continue;
      return {
        provider: candidate.provider,
        config: {
          clientId: process.env[candidate.idKey] || '',
          clientSecret: process.env[candidate.secretKey] || '',
          scopes: process.env[candidate.scopesKey] || candidate.defaultScopes,
        },
      };
    }

    return null;
  }

  private static readonly envCandidates = [
    {
      provider: 'google',
      idKey: 'GOOGLE_CLIENT_ID',
      secretKey: 'GOOGLE_CLIENT_SECRET',
      scopesKey: 'GOOGLE_SCOPES',
      defaultScopes: 'openid email profile',
    },
    {
      provider: 'microsoft',
      idKey: 'MICROSOFT_CLIENT_ID',
      secretKey: 'MICROSOFT_CLIENT_SECRET',
      scopesKey: 'MICROSOFT_SCOPES',
      defaultScopes: 'openid email profile',
    },
    {
      provider: 'github',
      idKey: 'GITHUB_CLIENT_ID',
      secretKey: 'GITHUB_CLIENT_SECRET',
      scopesKey: 'GITHUB_SCOPES',
      defaultScopes: 'read:user user:email',
    },
  ];
}
