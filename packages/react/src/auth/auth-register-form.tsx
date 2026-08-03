import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import type { IAuthFormProps } from '@react/auth/interfaces/auth-form-props.interface';
import type { IAuthRegisterFormState } from '@react/auth/interfaces/auth-register-form-state.interface';

/**
 * Framework-default registration form: firstName / lastName / email / password → `systemAuth.register`.
 * When the account is created without email verification it auto-signs-in (`systemAuth.login` + session
 * store) and navigates to `/account`; when verification is required it shows a "check your inbox" state.
 */
export class AuthRegisterForm extends AuthFormBase<IAuthFormProps, IAuthRegisterFormState> {
  state: IAuthRegisterFormState = {
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    loading: false, error: '', verificationPending: false,
  };

  private validate(): string {
    const { firstName, email, password, confirmPassword } = this.state;
    if (!firstName.trim()) return this.tr('auth.register.firstNameRequired', 'Please enter your first name.');
    if (!/\S+@\S+\.\S+/.test(email.trim())) return this.tr('auth.register.invalidEmail', 'Please enter a valid email address.');
    if (!password || password.length < 8) return this.tr('auth.register.passwordMin', 'Password must be at least 8 characters.');
    if (password !== confirmPassword) return this.tr('auth.register.mismatch', 'The passwords do not match.');
    return '';
  }

  private async handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const validationError = this.validate();
    if (validationError) {
      this.setState({ error: validationError });
      return;
    }
    this.setState({ loading: true, error: '' });
    const { email, password, firstName, lastName } = this.state;
    try {
      const data = await this.systemAuth.register(
        { email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() },
        { silent: true, noDedupe: true },
      );
      if (data && data.success === false) {
        throw new Error(data?.message || this.tr('auth.register.failed', 'Registration failed. Please try again.'));
      }
      if (data?.requiresEmailVerification) {
        this.setState({ verificationPending: true });
        return;
      }
      const loginData = await this.systemAuth.login({ email: email.trim(), password }, { silent: true, noDedupe: true });
      if (loginData?.token) {
        this.session.storeSession(loginData.token, loginData.user);
        this.navigateAfterAuth();
        return;
      }
      this.setState({ verificationPending: true });
    } catch (error: any) {
      this.setState({ error: this.errorMessage(error, this.tr('auth.register.failed', 'Registration failed. Please try again.')) });
    } finally {
      this.setState({ loading: false });
    }
  }

  private switchToLogin(event: ReactMouseEvent): void {
    if (!this.props.onSwitchMode) return;
    event.preventDefault();
    this.props.onSwitchMode(AuthMode.LOGIN);
  }

  private renderVerificationPending(): ReactNode {
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.register.checkInboxTitle', 'Check your inbox')}</h1>
        <div className="fc-auth__notice">
          {this.tr('auth.register.checkInboxBody', 'Your account was created. We sent a verification link to your email — confirm it to sign in.')}
        </div>
        <p className="fc-auth__switch">
          <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
            {this.tr('auth.register.backToLogin', 'Back to sign in')}
          </a>
        </p>
      </div>
    );
  }

  render(): ReactNode {
    if (this.state.verificationPending) return this.renderVerificationPending();
    const { firstName, lastName, email, password, confirmPassword, loading, error } = this.state;
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">{this.tr('auth.register.title', 'Create your account')}</h1>
        <p className="fc-auth__subtitle">{this.tr('auth.register.subtitle', 'It only takes a moment to get started.')}</p>
        <form onSubmit={(event) => this.handleSubmit(event)}>
          {error ? <div className="fc-auth__error">{error}</div> : null}
          {this.renderField(this.tr('auth.register.firstName', 'First name'), 'text', firstName, (v) => this.setState({ firstName: v }), { autoComplete: 'given-name', name: 'firstName' })}
          {this.renderField(this.tr('auth.register.lastName', 'Last name'), 'text', lastName, (v) => this.setState({ lastName: v }), { autoComplete: 'family-name', name: 'lastName' })}
          {this.renderField(this.tr('auth.email', 'Email'), 'email', email, (v) => this.setState({ email: v }), { autoComplete: 'email', name: 'email', placeholder: this.tr('auth.emailPlaceholder', 'you@example.com') })}
          {this.renderField(this.tr('auth.password', 'Password'), 'password', password, (v) => this.setState({ password: v }), { autoComplete: 'new-password', name: 'password', placeholder: this.tr('auth.register.passwordHint', 'At least 8 characters') })}
          {this.renderField(this.tr('auth.register.confirmPassword', 'Confirm password'), 'password', confirmPassword, (v) => this.setState({ confirmPassword: v }), { autoComplete: 'new-password', name: 'confirmPassword' })}
          <button type="submit" disabled={loading} className="fc-auth__button">
            {loading ? this.tr('auth.register.submitting', 'Creating account…') : this.tr('auth.register.submit', 'Create account')}
          </button>
        </form>
        <p className="fc-auth__switch">
          {this.tr('auth.register.haveAccount', 'Already have an account?')}{' '}
          <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
            {this.tr('auth.register.loginLink', 'Sign in')}
          </a>
        </p>
      </div>
    );
  }
}
