import type { FormEvent, ReactNode } from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { AuthFormBase } from '@react/auth/auth-form-base';
import { AuthVerifyStatus } from '@react/auth/enums/auth-verify-status.enum';
import type { IAuthFormProps } from '@react/auth/interfaces/auth-form-props.interface';
import type { IAuthVerifyFormState } from '@react/auth/interfaces/auth-verify-form-state.interface';

/**
 * Framework-default "confirm your email" page. The emailed link carries `?token=`; the page redeems it
 * on arrival, so the visitor never types a token. Confirmed → a short message and the sign-in button,
 * nothing else. Only when there was no token or the server refused it does the page offer a new link.
 *
 * A token is redeemed once per page load: React's development double-mount would otherwise post it
 * twice and the second, already-used attempt would paint "invalid link" over a confirmation that worked.
 */
export class AuthVerifyForm extends AuthFormBase<IAuthFormProps, IAuthVerifyFormState> {
  private static readonly redeemed = new Map<string, Promise<void>>();

  state: IAuthVerifyFormState = {
    status: AuthVerifyStatus.VERIFYING, error: '', email: '', resending: false, resendNotice: '', resendError: '',
  };

  componentDidMount(): void {
    const token = this.browserState.readQueryParamFromWindow('token');
    if (!token) {
      this.setState({ status: AuthVerifyStatus.NO_TOKEN });
      return;
    }
    const request: Promise<void> = AuthVerifyForm.redeemed.get(token)
      ?? this.systemAuth.verifyEmail(token, { silent: true, noDedupe: true }).then(() => undefined);
    if (!AuthVerifyForm.redeemed.has(token)) {
      AuthVerifyForm.redeemed.set(token, request);
      // Only a confirmation is final; a refused attempt may be tried again.
      request.catch(() => AuthVerifyForm.redeemed.delete(token));
    }
    request.then(
      () => this.setState({ status: AuthVerifyStatus.VERIFIED }),
      (error: unknown) => this.setState({
        status: AuthVerifyStatus.FAILED,
        error: this.errorMessage(error, this.tr('auth.verify.failed', 'The confirmation did not succeed. Request a new link below.')),
      }),
    );
  }

  private async handleResend(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const email = this.state.email.trim();
    if (!/\S+@\S+\.\S+/.test(email)) {
      this.setState({ resendError: this.tr('auth.errors.emailRequired', 'Please enter a valid email address.'), resendNotice: '' });
      return;
    }
    this.setState({ resending: true, resendError: '', resendNotice: '' });
    try {
      const data = await this.systemAuth.resendVerification(email, { silent: true, noDedupe: true });
      this.setState({
        resendNotice: data?.alreadyVerified
          ? this.tr('auth.verify.alreadyVerified', 'This email is already confirmed. You can sign in.')
          : this.tr('auth.verify.resent', 'If an account with this email exists, we sent a new confirmation link.'),
      });
    } catch (error: unknown) {
      this.setState({ resendError: this.errorMessage(error, this.tr('auth.errors.emailSendFailed', 'We could not send the email. Please try again later.')) });
    } finally {
      this.setState({ resending: false });
    }
  }

  private renderLoginButton(): ReactNode {
    return (
      <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__button">
        {this.tr('auth.verify.toLogin', 'Sign in')}
      </a>
    );
  }

  private renderResend(): ReactNode {
    const { email, resending, resendNotice, resendError } = this.state;
    if (resendNotice) return <div className="fc-auth__notice">{resendNotice}</div>;
    return (
      <form onSubmit={(event) => this.handleResend(event)}>
        {resendError ? <div className="fc-auth__error">{resendError}</div> : null}
        {this.renderField(this.tr('auth.email', 'Email'), 'email', email, (v) => this.setState({ email: v }), { autoComplete: 'email', name: 'email', placeholder: this.tr('auth.emailPlaceholder', 'you@example.com') })}
        <button type="submit" disabled={resending} className="fc-auth__button">
          {resending ? this.tr('auth.verify.resending', 'Sending…') : this.tr('auth.verify.resendSubmit', 'Send a new link')}
        </button>
      </form>
    );
  }

  render(): ReactNode {
    const { status, error } = this.state;
    if (status === AuthVerifyStatus.VERIFYING) {
      return (
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{this.tr('auth.verify.title', 'Confirm your email')}</h1>
          <p className="fc-auth__subtitle">{this.tr('auth.verify.verifying', 'Confirming your email…')}</p>
        </div>
      );
    }
    if (status === AuthVerifyStatus.VERIFIED) {
      return (
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{this.tr('auth.verify.successTitle', 'Your email is confirmed')}</h1>
          <div className="fc-auth__notice">{this.tr('auth.verify.successBody', 'Thank you. You can now sign in to your account.')}</div>
          {this.renderLoginButton()}
        </div>
      );
    }
    const failed = status === AuthVerifyStatus.FAILED;
    return (
      <div className="fc-auth__card">
        <h1 className="fc-auth__title">
          {failed ? this.tr('auth.verify.failedTitle', 'We could not confirm your email') : this.tr('auth.verify.missingTitle', 'Check your inbox')}
        </h1>
        {failed
          ? <div className="fc-auth__error">{error}</div>
          : <p className="fc-auth__subtitle">{this.tr('auth.verify.missingBody', 'Open the confirmation link we sent to your email. Did not get it? Enter your email and we will send a new one.')}</p>}
        {status.offersResend ? this.renderResend() : null}
        <p className="fc-auth__switch">
          <a href={RouteConstants.SEGMENTS.LOGIN} className="fc-auth__link">{this.tr('auth.register.backToLogin', 'Back to sign in')}</a>
        </p>
      </div>
    );
  }
}
