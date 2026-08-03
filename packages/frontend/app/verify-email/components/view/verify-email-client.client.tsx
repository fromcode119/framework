import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import Link from 'next/link';
import Script from 'next/script';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { VerifyEmailCaptchaService } from '@/app/verify-email/verify-email-captcha-service';
import { VerifyEmailResendCard } from '@/app/verify-email/components/view/verify-email-resend-card.client';
import { VerifyEmailVerificationCard } from '@/app/verify-email/components/view/verify-email-verification-card.client';
import { VerifyEmailCopyService } from '@/app/verify-email/verify-email-copy-service';

export class VerifyEmailPage extends Reactor {
  @prop declare initialLocale: string;

  @state token = '';
  @state emailForResend = '';
  @state status: VerificationStatus = VerificationStatus.IDLE;
  @state message = '';
  @state isResending = false;
  @state resendStatus: VerificationStatus = VerificationStatus.IDLE;
  @state resendMessage = '';
  @state resendVerificationUrl = '';

  private get copy() {
    return VerifyEmailCopyService.getCopy(this.initialLocale);
  }

  private get recaptchaSiteKey(): string {
    return String(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '').trim();
  }

  private get resendCaptchaAction(): string {
    return VerifyEmailCaptchaService.resendVerificationAction;
  }

  private async executeCaptcha(): Promise<string> {
    if (!this.recaptchaSiteKey) return '';
    const grecaptcha = (window as Window & {
      grecaptcha?: {
        ready(callback: () => void): void;
        execute(siteKey: string, options: { action: string }): Promise<string>;
      };
    }).grecaptcha;
    if (!grecaptcha?.ready || !grecaptcha?.execute) return '';
    await new Promise<void>((resolve) => grecaptcha.ready(() => resolve()));
    return String(await grecaptcha.execute(this.recaptchaSiteKey, { action: this.resendCaptchaAction }) || '').trim();
  }

  @bound
  async verify(tokenValue: string): Promise<void> {
    const copy = this.copy;
    if (!tokenValue) {
      this.status = VerificationStatus.ERROR;
      this.message = copy.missingToken;
      return;
    }

    this.status = VerificationStatus.VERIFYING;
    this.message = '';
    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ token: tokenValue })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendMessage = String(payload?.error || payload?.message || '').trim();
        if (backendMessage === 'Invalid verification token') {
          throw new Error(copy.invalidToken);
        }
        if (backendMessage === 'Verification link has expired. Please request a new one.') {
          throw new Error(copy.expiredToken);
        }
        throw new Error(backendMessage || copy.verifyFailed);
      }
      this.status = VerificationStatus.SUCCESS;
      this.message = copy.verifySuccess;
    } catch (err: unknown) {
      this.status = VerificationStatus.ERROR;
      this.message = err instanceof Error ? err.message : copy.verifyFailed;
    }
  }

  @bound
  async resend(event: React.FormEvent): Promise<void> {
    const copy = this.copy;
    event.preventDefault();
    this.resendStatus = VerificationStatus.IDLE;
    this.resendMessage = '';
    this.resendVerificationUrl = '';
    this.isResending = true;
    try {
      const captchaToken = await this.executeCaptcha();
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          email: this.emailForResend,
          captchaToken: captchaToken || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendMessage = String(payload?.error || payload?.message || '').trim();
        if (payload?.requiresCaptcha) {
          throw new Error(copy.captchaRequired);
        }
        if (backendMessage === 'Too many verification email requests. Please try again later.') {
          throw new Error(copy.rateLimited);
        }
        throw new Error(backendMessage || copy.resendFailed);
      }
      this.resendStatus = VerificationStatus.SUCCESS;
      if (payload?.alreadyVerified) {
        this.resendMessage = copy.alreadyVerified;
      } else {
        this.resendMessage = copy.resendSuccess;
      }
      if (payload?.verificationUrl) {
        this.resendVerificationUrl = String(payload.verificationUrl);
      }
    } catch (err: unknown) {
      this.resendStatus = VerificationStatus.ERROR;
      this.resendMessage = err instanceof Error ? err.message : copy.resendFailed;
    } finally {
      this.isResending = false;
    }
  }

  componentDidMount(): void {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) {
      this.token = tokenFromUrl;
      this.verify(tokenFromUrl);
    }
  }

  @bound
  protected onTokenChange(next: string): void {
    this.token = next;
  }

  @bound
  protected onVerify(): void {
    this.verify(this.token);
  }

  @bound
  protected onEmailChange(next: string): void {
    this.emailForResend = next;
  }

  render(): ReactNode {
    const copy = this.copy;
    const recaptchaSiteKey = this.recaptchaSiteKey;
    return (
      <main className="fc-auth-page fc-verify-email-page min-h-screen bg-slate-50 text-slate-900">
        {recaptchaSiteKey ? (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`}
            strategy="afterInteractive"
          />
        ) : null}
        <div className="fc-auth-shell mx-auto max-w-xl px-6 py-16">
          <Link href="/" className="fc-auth-back-link">
            {`← ${copy.backHome}`}
          </Link>

          <div className="fc-auth-hero">
            <p className="fc-auth-kicker">{copy.kicker}</p>
            <h1 className="fc-auth-title">{copy.title}</h1>
            <p className="fc-auth-description">
              {copy.description}
            </p>
          </div>

          <VerifyEmailVerificationCard
            token={this.token}
            status={this.status}
            message={this.message}
            verificationTokenLabel={copy.verificationTokenLabel}
            verificationTokenPlaceholder={copy.verificationTokenPlaceholder}
            verifyingLabel={copy.verifying}
            verifyButtonLabel={copy.verifyButton}
            goToLoginLabel={copy.goToLogin}
            verificationErrorNote={copy.verificationErrorNote}
            onTokenChange={this.onTokenChange}
            onVerify={this.onVerify}
          />

          <VerifyEmailResendCard
            email={this.emailForResend}
            isResending={this.isResending}
            resendMessage={this.resendMessage}
            resendStatus={this.resendStatus}
            resendVerificationUrl={this.resendVerificationUrl}
            resendTitle={copy.resendTitle}
            resendDescription={copy.resendDescription}
            emailLabel={copy.emailLabel}
            resendSendingLabel={copy.resendSending}
            resendButtonLabel={copy.resendButton}
            openVerificationLinkLabel={copy.openVerificationLink}
            goToLoginLabel={copy.goToLogin}
            onEmailChange={this.onEmailChange}
            onSubmit={this.resend}
          />

          <p className="fc-auth-footer">
            {copy.noAccount}{' '}
            <Link href="/register" className="fc-auth-footer-link">
              {copy.register}
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
