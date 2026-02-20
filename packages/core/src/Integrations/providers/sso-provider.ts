import { IntegrationTypeDefinition } from '../integration-registry';

type SsoProviderConfig = Record<string, any>;

function normalizeSsoConfig(input: Record<string, any>): SsoProviderConfig {
  return {
    clientId: String(input?.clientId || '').trim(),
    clientSecret: String(input?.clientSecret || '').trim(),
    scopes: String(input?.scopes || '').trim(),
    issuer: String(input?.issuer || '').trim(),
    authorizeUrl: String(input?.authorizeUrl || '').trim(),
    tokenUrl: String(input?.tokenUrl || '').trim(),
    userInfoUrl: String(input?.userInfoUrl || '').trim()
  };
}

function resolveSsoFromEnv() {
  const configured = String(process.env.SSO_PROVIDER || '').trim().toLowerCase();
  if (configured) {
    return { provider: configured, config: {} };
  }

  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
    return {
      provider: 'google',
      config: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        scopes: process.env.GOOGLE_SCOPES || 'openid email profile'
      }
    };
  }

  if (process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_SECRET) {
    return {
      provider: 'microsoft',
      config: {
        clientId: process.env.MICROSOFT_CLIENT_ID || '',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
        scopes: process.env.MICROSOFT_SCOPES || 'openid email profile'
      }
    };
  }

  if (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_SECRET) {
    return {
      provider: 'github',
      config: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        scopes: process.env.GITHUB_SCOPES || 'read:user user:email'
      }
    };
  }

  return null;
}

const commonOauthFields = [
  {
    name: 'clientId',
    label: 'Client ID',
    type: 'text' as const,
    required: true
  },
  {
    name: 'clientSecret',
    label: 'Client Secret',
    type: 'password' as const,
    required: true
  },
  {
    name: 'scopes',
    label: 'Scopes',
    type: 'text' as const,
    description: 'Space-separated scopes. Example: "openid email profile".'
  }
];

export const SsoIntegrationDefinition: IntegrationTypeDefinition<any> = {
  key: 'sso',
  label: 'Federated Login (SSO)',
  description: 'OAuth/OpenID provider credentials used for customer/admin single sign-on.',
  defaultProvider: 'google',
  resolveFromEnv: resolveSsoFromEnv,
  providers: [
    {
      key: 'google',
      label: 'Google OAuth',
      description: 'Sign in with Google accounts.',
      fields: commonOauthFields,
      normalizeConfig: normalizeSsoConfig,
      create: (config) => ({ provider: 'google', ...normalizeSsoConfig(config) })
    },
    {
      key: 'microsoft',
      label: 'Microsoft OAuth',
      description: 'Sign in with Microsoft/Azure AD accounts.',
      fields: commonOauthFields,
      normalizeConfig: normalizeSsoConfig,
      create: (config) => ({ provider: 'microsoft', ...normalizeSsoConfig(config) })
    },
    {
      key: 'github',
      label: 'GitHub OAuth',
      description: 'Sign in with GitHub accounts.',
      fields: commonOauthFields,
      normalizeConfig: normalizeSsoConfig,
      create: (config) => ({ provider: 'github', ...normalizeSsoConfig(config) })
    },
    {
      key: 'openid',
      label: 'Generic OpenID Connect',
      description: 'Custom OpenID Connect provider (self-hosted/enterprise).',
      fields: [
        ...commonOauthFields,
        {
          name: 'issuer',
          label: 'Issuer URL',
          type: 'text',
          required: true
        },
        {
          name: 'authorizeUrl',
          label: 'Authorize URL',
          type: 'text',
          required: true
        },
        {
          name: 'tokenUrl',
          label: 'Token URL',
          type: 'text',
          required: true
        },
        {
          name: 'userInfoUrl',
          label: 'UserInfo URL',
          type: 'text',
          required: false
        }
      ],
      normalizeConfig: normalizeSsoConfig,
      create: (config) => ({ provider: 'openid', ...normalizeSsoConfig(config) })
    }
  ]
};
