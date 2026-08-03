import type { ReactNode } from 'react';
import { Platform } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthLoginForm } from '@react/auth/auth-login-form';
import { AuthRegisterForm } from '@react/auth/auth-register-form';
import { AuthForgotForm } from '@react/auth/auth-forgot-form';
import { AuthResetForm } from '@react/auth/auth-reset-form';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import type { IAuthShellProps } from '@react/auth/interfaces/auth-shell-props.interface';
import type { IAuthShellState } from '@react/auth/interfaces/auth-shell-state.interface';

/**
 * Framework-default auth page. A complete, neutral (theme-agnostic, inline-styled, unbranded) renderer
 * for the login / register / forgot-password / reset-password surfaces so ANY install has working auth
 * pages with no theme work. Additive: a branded theme keeps its own auth pages and never mounts this.
 *
 * The active surface comes from the `mode` prop, else from the URL path (`/login`, `/register`,
 * `/forgot-password`, `/reset-password`) — mirroring how AccountShell reads its section. Switching modes
 * is a client-side `history.pushState` + `setState` (with `<a href>` preserved for no-JS / middle-click).
 * If the framework session already has a user, it shows a "you're signed in" state instead.
 */
export class AuthShell extends AuthFormBase<IAuthShellProps, IAuthShellState> {
  private boundPopState?: () => void;

  constructor(props: IAuthShellProps) {
    super(props);
    this.state = { mode: props.mode || AuthShell.readModeFromUrl(), signedInUser: null };
  }

  static readModeFromUrl(): AuthMode {
    if (!Platform.isBrowser) return AuthMode.LOGIN;
    return AuthMode.fromPath(window.location.pathname || '');
  }

  componentDidMount(): void {
    // Reset (a token link) is a fresh set-password action even for a signed-in visitor — never short it.
    if (this.state.mode !== AuthMode.RESET) {
      const user = this.session.readStoredUser();
      if (user) this.setState({ signedInUser: user });
    }
    if (Platform.isBrowser) {
      this.boundPopState = () => this.setState({ mode: this.props.mode || AuthShell.readModeFromUrl() });
      window.addEventListener('popstate', this.boundPopState);
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
      case AuthMode.REGISTER: return <AuthRegisterForm onSwitchMode={onSwitchMode} />;
      case AuthMode.FORGOT: return <AuthForgotForm onSwitchMode={onSwitchMode} />;
      case AuthMode.RESET: return <AuthResetForm onSwitchMode={onSwitchMode} />;
      default: return <AuthLoginForm onSwitchMode={onSwitchMode} />;
    }
  }

  render(): ReactNode {
    if (this.state.signedInUser) return this.renderSignedIn();
    return this.renderForm();
  }
}
