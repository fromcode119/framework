import { Enum } from '@fromcode119/react-class-components';

/**
 * The OAuth providers the `sso` integration offers (Settings → Integrations → Federated Login), with
 * their fixed endpoints. `OPENID` has none of its own: a generic OpenID Connect provider brings its
 * issuer, authorize, token and userinfo addresses in its config.
 */
export class SsoOauthProvider extends Enum {
  static readonly GOOGLE = new SsoOauthProvider('google', 'Google',
    'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token',
    'https://openidconnect.googleapis.com/v1/userinfo', '', 'openid email profile');
  /** Identity comes from the id token of the back-channel exchange: Microsoft has no userinfo email. */
  static readonly MICROSOFT = new SsoOauthProvider('microsoft', 'Microsoft',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    '', '', 'openid email profile');
  static readonly GITHUB = new SsoOauthProvider('github', 'GitHub',
    'https://github.com/login/oauth/authorize', 'https://github.com/login/oauth/access_token',
    'https://api.github.com/user', 'https://api.github.com/user/emails', 'read:user user:email');
  static readonly OPENID = new SsoOauthProvider('openid', 'OpenID Connect', '', '', '', '', 'openid email profile');

  /**
   * The Microsoft tenant of personal (consumer) accounts. Microsoft verifies those addresses itself; an
   * organisation's directory can put any address in `email`, so a work account's address counts only
   * when the token also carries `xms_edov` (email domain owner verified).
   */
  static readonly MICROSOFT_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

  private constructor(
    value: string,
    readonly label: string,
    readonly authorizeUrl: string,
    readonly tokenUrl: string,
    readonly userInfoUrl: string,
    readonly emailsUrl: string,
    readonly defaultScopes: string,
  ) {
    super(value);
  }

  static resolve(value: unknown): SsoOauthProvider | undefined {
    return SsoOauthProvider.fromValue(String(value ?? '').trim().toLowerCase());
  }
}
