import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthSocialSignIn } from '@react/auth/auth-social-sign-in';
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
    loading: false, error: '', verificationPending: false, emailNotSent: false, resending: false, resendError: '',
  };

  private validate(): string {
    const { firstName, email, password, confirmPassword } = this.state;
    if (!firstName.trim()) return this.tr('auth.register.firstNameRequired', 'Please enter your first name.');
    if (!/\S+@\S+\.\S+/.test(email.trim())) return this.tr('auth.register.invalidEmail', 'Please enter a valid email address.');
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
        { email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(), next: this.requestedNext || undefined },
        { silent: true, noDedupe: true },
      );
      if (data && data.success === false) {
        throw { data };
      }
      if (data?.requiresEmailVerification) {
        // The server says whether the email left. Telling the person to check their inbox when it did
        // not leaves them waiting for a message that is never coming.
        this.setState({ loading: false, verificationPending: true, emailNotSent: data.emailDelivery === 'failed' });
        return;
      }
      const loginData = await this.systemAuth.login({ email: email.trim(), password }, { silent: true, noDedupe: true });
      if (loginData?.token) {
        this.session.storeSession(loginData.user);
        // Stays busy until the next page replaces this one (see AuthLoginForm).
        this.navigateAfterAuth();
        return;
      }
      this.setState({ loading: false, verificationPending: true });
    } catch (error: any) {
      this.setState({ loading: false, error: this.errorMessage(error, this.tr('auth.register.failed', 'Registration failed. Please try again.')) });
    }
  }

  private switchToLogin(event: ReactMouseEvent): void {
    if (!this.props.onSwitchMode) return;
    event.preventDefault();
    this.props.onSwitchMode(AuthMode.LOGIN);
  }

  private async handleResend(): Promise<void> {
    this.setState({ resending: true, resendError: '' });
    try {
      const data = await this.systemAuth.resendVerification(this.state.email.trim(), { silent: true, noDedupe: true }, this.requestedNext || undefined);
      if (data?.emailDelivery === 'failed') throw new Error('');
      this.setState({ resending: false, emailNotSent: false });
    } catch (error: unknown) {
      this.setState({ resending: false, resendError: this.errorMessage(error, this.tr('auth.errors.emailSendFailed', 'We could not send the email. Please try again later.')) });
    }
  }

  private renderEmailNotSent(): ReactNode {
    const { resending, resendError } = this.state;
    return (
      <>
        <div className="fc-auth__error">
          {this.tr('auth.register.emailNotSentBody', 'Your account was created, but we could not send the confirmation email. Send it again; if it still does not arrive, contact us.')}
        </div>
        {resendError ? <div className="fc-auth__error">{resendError}</div> : null}
        <button type="button" disabled={resending} className="fc-auth__button" onClick={() => { void this.handleResend(); }}>
          {resending ? this.tr('auth.register.resending', 'Sending…') : this.tr('auth.register.resend', 'Send the confirmation email again')}
        </button>
      </>
    );
  }

  private renderVerificationPending(): ReactNode {
    const { emailNotSent } = this.state;
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">
          {emailNotSent ? this.tr('auth.register.emailNotSentTitle', 'Your account was created') : this.tr('auth.register.checkInboxTitle', 'Check your inbox')}
        </h1>
        {emailNotSent ? this.renderEmailNotSent() : (
          <div className="fc-auth__notice">
            {this.tr('auth.register.checkInboxBody', 'Your account was created. We sent a verification link to your email — confirm it to sign in.')}
          </div>
        )}
        <p className="fc-auth__switch">
          <a href={this.loginHref} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
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
          {this.renderField(this.tr('auth.password', 'Password'), 'password', password, (v) => this.setState({ password: v }), { autoComplete: 'new-password', name: 'password' })}
          {this.renderField(this.tr('auth.register.confirmPassword', 'Confirm password'), 'password', confirmPassword, (v) => this.setState({ confirmPassword: v }), { autoComplete: 'new-password', name: 'confirmPassword' })}
          <button type="submit" disabled={loading} className="fc-auth__button">
            {loading ? this.tr('auth.register.submitting', 'Creating account…') : this.tr('auth.register.submit', 'Create account')}
          </button>
        </form>
        <AuthSocialSignIn />
        <p className="fc-auth__switch">
          {this.tr('auth.register.haveAccount', 'Already have an account?')}{' '}
          <a href={this.loginHref} className="fc-auth__link" onClick={(e) => this.switchToLogin(e)}>
            {this.tr('auth.register.loginLink', 'Sign in')}
          </a>
        </p>
      </div>
    );
  }
}
