import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import type { IAuthFormProps } from '@react/auth/interfaces/auth-form-props.interface';
import type { IAuthLoginFormState } from '@react/auth/interfaces/auth-login-form-state.interface';

/**
 * Framework-default sign-in form: email + password → `systemAuth.login` → stores the session via the
 * framework `SystemAuthSession` → navigates to `?next=` (safe) or `/account`. Neutral inline styling,
 * loading/error states, and links across to register / forgot-password.
 */
export class AuthLoginForm extends AuthFormBase<IAuthFormProps, IAuthLoginFormState> {
  state: IAuthLoginFormState = { email: '', password: '', loading: false, error: '' };

  private async handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const email = this.state.email.trim();
    if (!/\S+@\S+\.\S+/.test(email)) {
      this.setState({ error: this.tr('auth.login.invalidEmail', 'Please enter a valid email address.') });
      return;
    }
    if (!this.state.password) {
      this.setState({ error: this.tr('auth.login.passwordRequired', 'Please enter your password.') });
      return;
    }
    this.setState({ loading: true, error: '' });
    try {
      const data = await this.systemAuth.login(
        { email, password: this.state.password },
        { silent: true, noDedupe: true },
      );
      if (data?.token) {
        this.session.storeSession(data.token, data.user);
        this.navigateAfterAuth();
        return;
      }
      throw new Error(data?.message || this.tr('auth.login.failed', 'Incorrect email or password.'));
    } catch (error: any) {
      this.setState({ error: this.errorMessage(error, this.tr('auth.login.failed', 'Incorrect email or password.')) });
    } finally {
      this.setState({ loading: false });
    }
  }

  private switchTo(mode: AuthMode, event: ReactMouseEvent): void {
    if (!this.props.onSwitchMode) return;
    event.preventDefault();
    this.props.onSwitchMode(mode);
  }

  render(): ReactNode {
    const { email, password, loading, error } = this.state;
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.login.title', 'Sign in')}</h1>
        <p className="fc-auth__subtitle">{this.tr('auth.login.subtitle', 'Welcome back. Enter your details to continue.')}</p>
        <form onSubmit={(event) => this.handleSubmit(event)}>
          {error ? <div className="fc-auth__error">{error}</div> : null}
          {this.renderField(this.tr('auth.email', 'Email'), 'email', email, (v) => this.setState({ email: v }), { autoComplete: 'email', name: 'email', placeholder: this.tr('auth.emailPlaceholder', 'you@example.com') })}
          {this.renderField(this.tr('auth.password', 'Password'), 'password', password, (v) => this.setState({ password: v }), { autoComplete: 'current-password', name: 'password' })}
          <div className="fc-auth__forgot">
            <a href={RouteConstants.SEGMENTS.FORGOT_PASSWORD} className="fc-auth__link" onClick={(e) => this.switchTo(AuthMode.FORGOT, e)}>
              {this.tr('auth.login.forgot', 'Forgot password?')}
            </a>
          </div>
          <button type="submit" disabled={loading} className="fc-auth__button">
            {loading ? this.tr('auth.login.submitting', 'Signing in…') : this.tr('auth.login.submit', 'Sign in')}
          </button>
        </form>
        <p className="fc-auth__switch">
          {this.tr('auth.login.noAccount', "Don't have an account?")}{' '}
          <a href={RouteConstants.SEGMENTS.REGISTER} className="fc-auth__link" onClick={(e) => this.switchTo(AuthMode.REGISTER, e)}>
            {this.tr('auth.login.registerLink', 'Create one')}
          </a>
        </p>
      </div>
    );
  }
}
