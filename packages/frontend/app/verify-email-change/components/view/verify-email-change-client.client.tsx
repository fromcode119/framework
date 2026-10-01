import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import { Reactor, state, bound, prop } from '@fromcode119/react-class-components';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { FrontendTokenRedemption } from '@/lib/frontend-token-redemption';

export class VerifyEmailChangePage extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @state token = '';
  @state status: VerificationStatus = VerificationStatus.IDLE;
  @state message = '';

  @bound async confirmChange(value: string): Promise<void> {
    if (!value) {
      this.status = VerificationStatus.ERROR;
      this.message = 'Email change token is required.';
      return;
    }

    this.status = VerificationStatus.VERIFYING;
    this.message = '';
    try {
      const { ok, payload } = await FrontendTokenRedemption.redeem(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM), value);
      if (!ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to confirm email change.');
      }
      this.status = VerificationStatus.SUCCESS;
      this.message = payload?.message || 'Email changed successfully. Please sign in again.';
    } catch (err: any) {
      this.status = VerificationStatus.ERROR;
      this.message = err?.message || 'Failed to confirm email change.';
    }
  }

  componentDidMount(): void {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) {
      this.token = tokenFromUrl;
      this.confirmChange(tokenFromUrl);
    }
  }

  render() {
    return (
      <main className="fc-auth">
        <div className="fc-auth__card">
          <h1 className="fc-auth__title">{FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.confirmEmailChange')}</h1>
          <p className="fc-auth__subtitle">
            {FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.finalizeYourAccountEmailUpdate')}
          </p>

          <div>
            <label className="fc-auth__field">
              <span className="fc-auth__label">{FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.token')}</span>
              <input
                className="fc-auth__input"
                value={this.token}
                onChange={(event) => (this.token = event.target.value)}
                placeholder={FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.pasteEmailChangeToken')}
              />
            </label>

            <button
              type="button"
              onClick={() => this.confirmChange(this.token)}
              disabled={this.status === VerificationStatus.VERIFYING}
              className="fc-auth__button"
            >
              {this.status === VerificationStatus.VERIFYING ? FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.confirming') : FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.confirmEmailChange')}
            </button>

            {this.message ? (
              <div className={this.status === VerificationStatus.ERROR ? 'fc-auth__error' : 'fc-auth__notice'}>
                {this.message}
              </div>
            ) : null}
          </div>

          <p className="fc-auth__switch">
            {FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.needPasswordHelp')}{' '}
            <Link href="/forgot-password" className="fc-auth__link">
              {FrontendCopy.t(this.locale, 'frontend.verifyEmailChangeClient.resetPassword')}
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
