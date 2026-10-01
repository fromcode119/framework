import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import { Reactor, state, bound, prop } from '@fromcode119/react-class-components';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { FrontendAuthRequestHeaders } from '@/lib/frontend-auth-request-headers';

export class ForgotPasswordPage extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @state email = '';
  @state isSubmitting = false;
  @state error = '';
  @state message = '';

  @bound async handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    this.isSubmitting = true;
    this.error = '';
    this.message = '';

    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD, { context: 'frontend' }), {
        method: 'POST',
        credentials: 'include',
        headers: FrontendAuthRequestHeaders.json({ 'X-Reset-Context': 'frontend' }),
        body: JSON.stringify({ email: this.email, context: 'frontend' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to request password reset.');
      }
      this.message = payload?.message || 'If an account exists, a password reset link has been sent.';
    } catch (err: any) {
      this.error = err?.message || 'Failed to request password reset.';
    } finally {
      this.isSubmitting = false;
    }
  }

  render() {
    return (
      <main className="fc-auth">
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.forgotPassword')}</h1>
          <p className="fc-auth__subtitle">
            {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.enterYourEmailAndWe')}
          </p>

          <form onSubmit={this.handleSubmit}>
            {this.error ? (
              <div className="fc-auth__error">{this.error}</div>
            ) : null}
            {this.message ? (
              <div className="fc-auth__notice">
                <p>{this.message}</p>
              </div>
            ) : null}

            <label className="fc-auth__field">
              <span className="fc-auth__label">{FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.email')}</span>
              <input
                type="email"
                className="fc-auth__input"
                value={this.email}
                onChange={(event) => (this.email = event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <button
              type="submit"
              disabled={this.isSubmitting}
              className="fc-auth__button"
            >
              {this.isSubmitting ? FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.sending') : FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.sendResetLink')}
            </button>
          </form>

          <p className="fc-auth__switch">
            {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.needAccountVerification')}{' '}
            <Link href="/verify-email" className="fc-auth__link">
              {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.verifyEmail')}
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
