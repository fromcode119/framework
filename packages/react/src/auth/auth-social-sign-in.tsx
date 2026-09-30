import type { ReactNode } from 'react';
import { Platform } from '@fromcode119/react-class-components';
import { ApiPathUtils, RuntimeBridge, SystemConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthSocialProvider } from '@react/auth/auth-social-provider';
import type { IAuthSocialSignInState } from '@react/auth/interfaces/auth-social-sign-in-state.interface';

/**
 * "Continue with Google / Microsoft / GitHub": one link per provider the site has switched on and
 * configured (Settings → Integrations → Federated Login), and nothing at all when there are none.
 *
 * Each link starts the server's redirect sign-in and brings the visitor back to `?next=` (or the
 * account page); a refusal returns here with `?ssoError=<code>`, shown above the buttons.
 */
export class AuthSocialSignIn extends AuthFormBase<Record<string, never>, IAuthSocialSignInState> {
  state: IAuthSocialSignInState = { providers: [], error: '' };

  componentDidMount(): void {
    this.setState({ error: this.browserState.readQueryParamFromWindow('ssoError') });
    void this.loadProviders();
  }

  private async loadProviders(): Promise<void> {
    try {
      this.setState({ providers: AuthSocialProvider.list(await this.systemAuth.getSsoProviders({ silent: true })) });
    } catch {
      // No providers answer means no buttons: the password form still stands on its own.
    }
  }

  /** Where the provider link starts: the site's own API, with where to go after and where to report a refusal. */
  private startUrl(provider: AuthSocialProvider): string {
    const path = ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.SSO_START, { provider: provider.key }));
    const query = new URLSearchParams({ returnTo: this.afterAuthPath, errorTo: this.currentPathWithoutError });
    return `${ApiPathUtils.absoluteUrl(RuntimeBridge.resolveApiBaseUrl(), path)}?${query.toString()}`;
  }

  private get currentPathWithoutError(): string {
    if (!Platform.isBrowser) return '';
    const params = new URLSearchParams(window.location.search);
    params.delete('ssoError');
    const search = params.toString();
    return `${window.location.pathname}${search ? `?${search}` : ''}`;
  }

  /** English defaults for each refusal code the server sends; a locale pack translates `auth.social.errors.<code>`. */
  private static readonly ERRORS: Record<string, string> = {
    unverified_email: 'That account did not confirm its email address, so it cannot be used to sign in here.',
    registration_closed: 'There is no account with that email address, and new accounts cannot be created here.',
    account_inactive: 'This account is not active.',
    two_factor_required: 'This account uses two-step verification. Please sign in with your email and password.',
    workspace_denied: 'This account does not have access here.',
    sign_in_disabled: 'Signing in is not available at the moment.',
    not_enabled: 'Signing in with that provider is not available.',
    not_configured: 'Signing in with that provider is not available.',
    invalid_state: 'The sign-in took too long or was started elsewhere. Please try again.',
    provider_error: 'Signing in with that account did not work. Please try again.',
  };

  private get refusalMessage(): string {
    const code = this.state.error;
    const fallback = AuthSocialSignIn.ERRORS[code] ?? AuthSocialSignIn.ERRORS.provider_error;
    return this.tr(`auth.social.errors.${code in AuthSocialSignIn.ERRORS ? code : 'provider_error'}`, fallback);
  }

  private renderProvider(provider: AuthSocialProvider): ReactNode {
    return (
      <a key={provider.key} href={this.startUrl(provider)} className={`fc-auth__social-button fc-auth__social-button--${provider.key}`}>
        {this.tr('auth.social.continueWith', 'Continue with {{provider}}', { provider: provider.label })}
      </a>
    );
  }

  render(): ReactNode {
    const { providers, error } = this.state;
    if (!providers.length && !error) return null;
    return (
      <div className="fc-auth__social">
        {error ? <div className="fc-auth__error" role="alert">{this.refusalMessage}</div> : null}
        {providers.length ? (
          <>
            <div className="fc-auth__divider"><span>{this.tr('auth.social.or', 'or')}</span></div>
            {providers.map((provider) => this.renderProvider(provider))}
          </>
        ) : null}
      </div>
    );
  }
}
