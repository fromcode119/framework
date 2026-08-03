import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import type { IAuthFormProps } from '@react/auth/interfaces/auth-form-props.interface';
import type { IAuthForgotFormState } from '@react/auth/interfaces/auth-forgot-form-state.interface';

/**
 * Framework-default "forgot password" form: email → `systemAuth.forgotPassword`. The endpoint always
 * responds generically for privacy, so a network failure still lands on the neutral "check your inbox"
 * confirmation rather than leaking whether the address exists.
 */
export class AuthForgotForm extends AuthFormBase<IAuthFormProps, IAuthForgotFormState> {
  state: IAuthForgotFormState = { email: '', loading: false, sent: false, error: '' };

  private async handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const email = this.state.email.trim();
    if (!/\S+@\S+\.\S+/.test(email)) {
      this.setState({ error: this.tr('auth.forgot.invalidEmail', 'Please enter a valid email address.') });
      return;
    }
    this.setState({ loading: true, error: '' });
    try {
      await this.systemAuth.forgotPassword({ email, context: 'frontend' }, { silent: true, noDedupe: true });
      this.setState({ sent: true });
    } catch {
      // The endpoint always returns success for privacy; only a network failure lands here.
      this.setState({ sent: true });
    } finally {
      this.setState({ loading: false });
    }
  }

  private switchToLogin(event: ReactMouseEvent): void {
    if (!this.props.onSwitchMode) return;
    event.preventDefault();
    this.props.onSwitchMode(AuthMode.LOGIN);
  }

  render(): ReactNode {
    const { email, loading, sent, error } = this.state;
    if (sent) {
      return (
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{this.tr('auth.forgot.sentTitle', 'Check your inbox')}</h1>
          <div className="fc-auth__notice">
            {this.tr('auth.forgot.sentBody', 'If an account exists for that email, we sent a link to reset your password. The link is valid for a limited time.')}
          </div>
          <p className="fc-auth__switch">
            <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
              {this.tr('auth.forgot.backToLogin', 'Back to sign in')}
            </a>
          </p>
        </div>
      );
    }
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.forgot.title', 'Reset your password')}</h1>
        <p className="fc-auth__subtitle">{this.tr('auth.forgot.subtitle', 'Enter your account email and we will send you a reset link.')}</p>
        <form onSubmit={(event) => this.handleSubmit(event)}>
          {error ? <div className="fc-auth__error">{error}</div> : null}
          {this.renderField(this.tr('auth.email', 'Email'), 'email', email, (v) => this.setState({ email: v }), { autoComplete: 'email', name: 'email', placeholder: this.tr('auth.emailPlaceholder', 'you@example.com') })}
          <button type="submit" disabled={loading} className="fc-auth__button">
            {loading ? this.tr('auth.forgot.submitting', 'Sending…') : this.tr('auth.forgot.submit', 'Send reset link')}
          </button>
        </form>
        <p className="fc-auth__switch">
          <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
            {this.tr('auth.forgot.backToLogin', 'Back to sign in')}
          </a>
        </p>
      </div>
    );
  }
}
