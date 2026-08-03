import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
import { SsoProviderUtils } from '@core/integrations/providers/sso-provider-utils';

/**
 * The `sso` integration descriptor: which providers exist, what each needs configured, and how a
 * submitted config is normalised. Behaviour lives in {@link SsoProviderUtils}.
 */
export class SsoIntegrationDefinition {
  private static readonly commonOauthFields = [
    {
      name: 'clientId',
      label: 'Client ID',
      type: IntegrationConfigFieldType.TEXT,
      required: true,
    },
    {
      name: 'clientSecret',
      label: 'Client Secret',
      type: IntegrationConfigFieldType.PASSWORD,
      required: true,
    },
    {
      name: 'scopes',
      label: 'Scopes',
      type: IntegrationConfigFieldType.TEXT,
      description: 'Space-separated scopes. Example: "openid email profile".',
    },
  ];

  /** The extra endpoint fields a generic OIDC provider needs on top of the common OAuth ones. */
  private static readonly openIdFields = [
    { name: 'issuer', label: 'Issuer URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'authorizeUrl', label: 'Authorize URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'tokenUrl', label: 'Token URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'userInfoUrl', label: 'UserInfo URL', type: IntegrationConfigFieldType.TEXT, required: false },
  ];

  /** One provider entry; the four differ only by key/label/description and field list. */
  private static provider(key: string, label: string, description: string, extraFields: typeof SsoIntegrationDefinition.openIdFields = []) {
    return {
      key,
      label,
      description,
      fields: [...SsoIntegrationDefinition.commonOauthFields, ...extraFields],
      normalizeConfig: SsoProviderUtils.normalizeSsoConfig,
      create: (config: Record<string, unknown>) => ({
        provider: key,
        ...SsoProviderUtils.normalizeSsoConfig(config),
      }),
    };
  }

  static readonly definition: IIntegrationTypeDefinition<Record<string, unknown>> = {
    key: 'sso',
    label: 'Federated Login (SSO)',
    description: 'OAuth/OpenID provider credentials used for customer/admin single sign-on.',
    defaultProvider: 'google',
    resolveFromEnv: SsoProviderUtils.resolveSsoFromEnv,
    providers: [
      SsoIntegrationDefinition.provider('google', 'Google OAuth', 'Sign in with Google accounts.'),
      SsoIntegrationDefinition.provider('microsoft', 'Microsoft OAuth', 'Sign in with Microsoft/Azure AD accounts.'),
      SsoIntegrationDefinition.provider('github', 'GitHub OAuth', 'Sign in with GitHub accounts.'),
      SsoIntegrationDefinition.provider(
        'openid',
        'Generic OpenID Connect',
        'Custom OpenID Connect provider (self-hosted/enterprise).',
        SsoIntegrationDefinition.openIdFields,
      ),
    ],
  };
}
