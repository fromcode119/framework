import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
import type { IIntegrationConfigField } from '@core/integrations/interfaces/integration-config-field.interface';
import { SsoProviderUtils } from '@core/integrations/providers/sso-provider-utils';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';

/**
 * The `sso` integration descriptor: which providers exist, what each needs configured, and how a
 * submitted config is normalised. Behaviour lives in {@link SsoProviderUtils}.
 */
export class SsoIntegrationDefinition {
  private static readonly commonOauthFields: IIntegrationConfigField[] = [
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
  private static readonly openIdFields: IIntegrationConfigField[] = [
    { name: 'issuer', label: 'Issuer URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'authorizeUrl', label: 'Authorize URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'tokenUrl', label: 'Token URL', type: IntegrationConfigFieldType.TEXT, required: true },
    { name: 'userInfoUrl', label: 'UserInfo URL', type: IntegrationConfigFieldType.TEXT, required: false },
  ];

  /**
   * A native mobile app signs in with the provider's own SDK, and the id token it gets back names the
   * APP's client ID (Google: the iOS or Android OAuth client; Apple: the bundle ID), not the web one.
   * Each such ID must be listed, or the token is refused for naming a different application.
   */
  private static readonly appClientIdsField: IIntegrationConfigField = {
    name: SsoProviderUtils.APP_CLIENT_IDS,
    label: 'Mobile app client IDs',
    type: IntegrationConfigFieldType.TEXTAREA,
    description: 'One per line. Sign-in from your iOS or Android app is accepted only for the IDs listed here.',
  };

  /** One provider entry; the redirect providers differ only by key/label/description and field list. */
  private static provider(key: string, label: string, description: string, extraFields: IIntegrationConfigField[] = []) {
    return {
      key,
      label,
      description,
      fields: [...SsoIntegrationDefinition.commonOauthFields, ...extraFields],
      // The storefront's "Continue with …" button returns here; the provider refuses any redirect it
      // was not told about.
      setupAddresses: [{
        label: 'Redirect URI',
        path: ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemApiPaths.ALL.AUTH.SSO_CALLBACK, { provider: key })),
        description: 'Add this address to the allowed redirect URIs of the app you created with the provider.',
      }],
      normalizeConfig: SsoProviderUtils.normalizeSsoConfig,
      create: (config: Record<string, unknown>) => ({
        provider: key,
        ...SsoProviderUtils.normalizeSsoConfig(config),
      }),
    };
  }

  /**
   * Sign in with Apple, as an app does it: the app gets Apple's identity token from the device and
   * posts it to `/auth/sso/login`. There is no redirect sign-in for Apple here, so no secret and no
   * redirect address — only the IDs Apple writes into the token as its audience.
   */
  private static readonly apple = {
    key: 'apple',
    label: 'Sign in with Apple',
    description: 'Sign in with Apple from your iOS app.',
    fields: [
      {
        name: 'clientId',
        label: 'Bundle ID',
        type: IntegrationConfigFieldType.TEXT,
        required: true,
        description: 'Your iOS app\'s bundle ID, for example com.example.app. Apple names it in every sign-in token.',
      },
      SsoIntegrationDefinition.appClientIdsField,
    ],
    normalizeConfig: SsoProviderUtils.normalizeSsoConfig,
    create: (config: Record<string, unknown>) => ({
      provider: 'apple',
      ...SsoProviderUtils.normalizeSsoConfig(config),
    }),
  };

  static readonly definition: IIntegrationTypeDefinition<Record<string, unknown>> = {
    key: 'sso',
    label: 'Federated Login (SSO)',
    description: 'OAuth/OpenID provider credentials used for customer/admin single sign-on.',
    defaultProvider: 'google',
    // A site offers every sign-in provider it has switched on — one button each. Without this, saving one
    // provider switched every other one off, so a site could never offer more than one.
    allowMultipleActiveProviders: true,
    resolveFromEnv: SsoProviderUtils.resolveSsoFromEnv,
    providers: [
      SsoIntegrationDefinition.provider('google', 'Google OAuth', 'Sign in with Google accounts.', [SsoIntegrationDefinition.appClientIdsField]),
      SsoIntegrationDefinition.apple,
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
