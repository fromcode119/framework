import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { Platform } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import type { IAuthFormProps } from '@react/auth/interfaces/auth-form-props.interface';
import type { IAuthResetFormState } from '@react/auth/interfaces/auth-reset-form-state.interface';

/**
 * Framework-default "set a new password" form: reads the `?token=` from the reset email link via the
 * SDK browser-state authority, then `systemAuth.resetPassword({ token, newPassword })`. On success it
 * shows a confirmation and sends the visitor back to sign in.
 */
export class AuthResetForm extends AuthFormBase<IAuthFormProps, IAuthResetFormState> {
  state: IAuthResetFormState = { token: '', password: '', confirm: '', loading: false, done: false, error: '' };

  componentDidMount(): void {
    this.setState({ token: this.browserState.readQueryParamFromWindow('token') });
  }

  private async handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const { token, password, confirm } = this.state;
    if (!token) {
      this.setState({ error: this.tr('auth.reset.missingToken', 'This reset link is invalid or has expired. Request a new one.') });
      return;
    }
    if (password.length < 8) {
      this.setState({ error: this.tr('auth.reset.tooShort', 'Password must be at least 8 characters.') });
      return;
    }
    if (password !== confirm) {
      this.setState({ error: this.tr('auth.reset.mismatch', 'The passwords do not match.') });
      return;
    }
    this.setState({ loading: true, error: '' });
    try {
      await this.systemAuth.resetPassword({ token, newPassword: password }, { silent: true, noDedupe: true });
      this.setState({ done: true });
      if (Platform.isBrowser) {
        setTimeout(() => window.location.assign(RouteConstants.SEGMENTS.LOGIN), 2500);
      }
    } catch (error: any) {
      this.setState({ error: this.errorMessage(error, this.tr('auth.reset.failed', 'Could not reset the password. The link may have expired — request a new one.')) });
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
    const { password, confirm, loading, done, error } = this.state;
    if (done) {
      return (
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{this.tr('auth.reset.doneTitle', 'Password updated')}</h1>
          <div className="fc-auth__notice">{this.tr('auth.reset.doneBody', 'Your password has been changed. Redirecting you to sign in…')}</div>
          <p className="fc-auth__switch">
            <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
              {this.tr('auth.reset.goToLogin', 'Go to sign in')}
            </a>
          </p>
        </div>
      );
    }
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.reset.title', 'Set a new password')}</h1>
        <p className="fc-auth__subtitle">{this.tr('auth.reset.subtitle', 'Choose a new password for your account.')}</p>
        <form onSubmit={(event) => this.handleSubmit(event)}>
          {error ? <div className="fc-auth__error">{error}</div> : null}
          {this.renderField(this.tr('auth.reset.newPassword', 'New password'), 'password', password, (v) => this.setState({ password: v }), { autoComplete: 'new-password', name: 'password', placeholder: this.tr('auth.register.passwordHint', 'At least 8 characters') })}
          {this.renderField(this.tr('auth.reset.confirmPassword', 'Confirm password'), 'password', confirm, (v) => this.setState({ confirm: v }), { autoComplete: 'new-password', name: 'confirmPassword' })}
          <button type="submit" disabled={loading} className="fc-auth__button">
            {loading ? this.tr('auth.reset.submitting', 'Saving…') : this.tr('auth.reset.submit', 'Save new password')}
          </button>
        </form>
        <p className="fc-auth__switch">
          <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
            {this.tr('auth.reset.backToLogin', 'Back to sign in')}
          </a>
        </p>
      </div>
    );
  }
}
