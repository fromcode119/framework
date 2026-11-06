import type { ReactNode } from 'react';
import { Platform } from '@fromcode119/react-class-components';
import { RouteConstants, SdkClient } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthLoginForm } from '@react/auth/auth-login-form';
import { AuthRegisterForm } from '@react/auth/auth-register-form';
import { AuthForgotForm } from '@react/auth/auth-forgot-form';
import { AuthResetForm } from '@react/auth/auth-reset-form';
import { AuthVerifyForm } from '@react/auth/auth-verify-form';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import type { IAuthShellProps } from '@react/auth/interfaces/auth-shell-props.interface';
import type { IAuthShellState } from '@react/auth/interfaces/auth-shell-state.interface';
import { AuthShell } from '@react/auth/auth-shell';
import { AuthTranslations } from '@react/auth/auth-translations';

/**
 * The auth surface `AuthShell` renders inside its boundary — the framework-default auth page. A complete,
 * neutral (theme-agnostic, inline-styled, unbranded) renderer for the login / register / forgot-password /
 * reset-password surfaces so ANY install has working auth pages with no theme work. Additive: a branded
 * theme keeps its own auth pages and never mounts this.
 *
 * Registers itself as the boundary's default on evaluation (static initialiser below); the browser bridge
 * swaps in a `React.lazy` of this module so it stays out of the storefront's first chunk.
 *
 * The active surface comes from the `mode` prop, else from the URL path (`/login`, `/register`,
 * `/forgot-password`, `/reset-password`) — mirroring how AccountShell reads its section. Switching modes
 * is a client-side `history.pushState` + `setState` (with `<a href>` preserved for no-JS / middle-click).
 * If the server confirms a session for the stored user, it shows a "you're signed in" state instead.
 */
export class AuthShellImplementation extends AuthFormBase<IAuthShellProps, IAuthShellState> {
  protected static readonly registeredAsDefault = AuthShell.implementation.provideDefault(AuthShellImplementation);

  private boundPopState?: () => void;

  constructor(props: IAuthShellProps) {
    super(props);
    this.state = { mode: props.mode || AuthShellImplementation.readModeFromUrl(), signedInUser: null };
  }

  static readModeFromUrl(): AuthMode {
    if (!Platform.isBrowser) return AuthMode.LOGIN;
    return AuthMode.fromPath(window.location.pathname || '');
  }

  componentDidMount(): void {
    AuthTranslations.register();
    // Reset and verify (token links) are fresh actions even for a signed-in visitor — never short them.
    if (!this.state.mode.isTokenLink) {
      // The marker can arrive without this host's cached user: the server writes it with the session,
      // domain-wide, so a sign-in finished on another host of the site leaves only the marker here.
      const user = this.session.readStoredUser();
      if (user || this.session.hasStoredSession()) void this.confirmStoredSession(user);
    }
    if (Platform.isBrowser) {
      this.boundPopState = () => this.setState({ mode: this.props.mode || AuthShellImplementation.readModeFromUrl() });
      window.addEventListener('popstate', this.boundPopState);
    }
  }

  /**
   * The stored user is only a cache — the session behind it may have expired. Trusting it alone showed
   * "you're signed in" to a visitor whose session the server had already dropped, and its button led to
   * the account route, whose guard sent them straight back here: a loop with no way to sign in. So the
   * signed-in state waits for the same probe the account guard uses (`/auth/me/person`). A 401 means
   * the cache is stale and is cleared; any other failure leaves it alone and simply shows the form.
   */
  private async confirmStoredSession(user: any): Promise<void> {
    try {
      // A guest is refused with 401 (thrown below); an answer is a session even without a person record.
      const res = await new SdkClient(this.api).getAuth().get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      if (res && typeof res === 'object' && 'person' in res) {
        this.setState({ signedInUser: user || res?.person || res?.data?.person });
        return;
      }
      this.session.clearSession();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      // The runtime api throws with the response's `statusCode` attached.
      if (error?.statusCode === 401) this.session.clearSession();
    }
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser && this.boundPopState) {
      window.removeEventListener('popstate', this.boundPopState);
    }
  }

  private switchMode(mode: AuthMode): void {
    if (Platform.isBrowser && window.history && typeof window.history.pushState === 'function') {
      window.history.pushState({}, '', mode.path);
    }
    if (mode !== this.state.mode) this.setState({ mode });
  }

  private renderSignedIn(): ReactNode {
    const user = this.state.signedInUser || {};
    const name = user.firstName || user.name || user.email || '';
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.signedIn.title', "You're signed in")}</h1>
        <p className="fc-auth__subtitle">
          {name
            ? this.tr('auth.signedIn.bodyNamed', 'Signed in as {{name}}.', { name })
            : this.tr('auth.signedIn.body', 'You are already signed in.')}
        </p>
        <a href={RouteConstants.SEGMENTS.ACCOUNT} className="fc-auth__button">
          {this.tr('auth.signedIn.toAccount', 'Go to my account')}
        </a>
      </div>
    );
  }

  private renderForm(): ReactNode {
    const onSwitchMode = (mode: AuthMode) => this.switchMode(mode);
    switch (this.state.mode) {
      case AuthMode.REGISTER: return <AuthRegisterForm onSwitchMode={onSwitchMode} documentLocale={this.props.documentLocale} />;
      case AuthMode.FORGOT: return <AuthForgotForm onSwitchMode={onSwitchMode} documentLocale={this.props.documentLocale} />;
      case AuthMode.RESET: return <AuthResetForm onSwitchMode={onSwitchMode} documentLocale={this.props.documentLocale} />;
      case AuthMode.VERIFY: return <AuthVerifyForm onSwitchMode={onSwitchMode} documentLocale={this.props.documentLocale} />;
      default: return <AuthLoginForm onSwitchMode={onSwitchMode} documentLocale={this.props.documentLocale} />;
    }
  }

  render(): ReactNode {
    if (this.state.signedInUser) return this.renderSignedIn();
    return this.renderForm();
  }
}
