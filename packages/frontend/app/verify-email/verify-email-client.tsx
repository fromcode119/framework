"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { VerifyEmailCaptchaService } from './verify-email-captcha-service';
import VerifyEmailResendCard from './verify-email-resend-card';
import VerifyEmailVerificationCard from './verify-email-verification-card';
import { VerifyEmailCopyService } from './verify-email-copy-service';
export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  const copy = VerifyEmailCopyService.getCopy();
  const recaptchaSiteKey = String(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '').trim();
  const [token, setToken] = useState('');
  const [emailForResend, setEmailForResend] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');
  const [resendVerificationUrl, setResendVerificationUrl] = useState('');
  const resendCaptchaAction = VerifyEmailCaptchaService.resendVerificationAction;

  const executeCaptcha = async (): Promise<string> => {
    if (!recaptchaSiteKey) return '';
    const grecaptcha = (window as Window & {
      grecaptcha?: {
        ready(callback: () => void): void;
        execute(siteKey: string, options: { action: string }): Promise<string>;
      };
    }).grecaptcha;
    if (!grecaptcha?.ready || !grecaptcha?.execute) return '';
    await new Promise<void>((resolve) => grecaptcha.ready(() => resolve()));
    return String(await grecaptcha.execute(recaptchaSiteKey, { action: resendCaptchaAction }) || '').trim();
  };

  const verify = async (tokenValue: string) => {
    if (!tokenValue) {
      setStatus('error');
      setMessage(copy.missingToken);
      return;
    }

    setStatus('verifying');
    setMessage('');
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
      setStatus('success');
      setMessage(copy.verifySuccess);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : copy.verifyFailed);
    }
  };

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResendStatus('idle');
    setResendMessage('');
    setResendVerificationUrl('');
    setIsResending(true);
    try {
      const captchaToken = await executeCaptcha();
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          email: emailForResend,
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
      setResendStatus('success');
      if (payload?.alreadyVerified) {
        setResendMessage(copy.alreadyVerified);
      } else {
        setResendMessage(copy.resendSuccess);
      }
      if (payload?.verificationUrl) {
        setResendVerificationUrl(String(payload.verificationUrl));
      }
    } catch (err: unknown) {
      setResendStatus('error');
      setResendMessage(err instanceof Error ? err.message : copy.resendFailed);
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      verify(tokenFromUrl);
    }
  }, []);

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
          token={token}
          status={status}
          message={message}
          verificationTokenLabel={copy.verificationTokenLabel}
          verificationTokenPlaceholder={copy.verificationTokenPlaceholder}
          verifyingLabel={copy.verifying}
          verifyButtonLabel={copy.verifyButton}
          goToLoginLabel={copy.goToLogin}
          verificationErrorNote={copy.verificationErrorNote}
          onTokenChange={setToken}
          onVerify={() => verify(token)}
        />

        <VerifyEmailResendCard
          email={emailForResend}
          isResending={isResending}
          resendMessage={resendMessage}
          resendStatus={resendStatus}
          resendVerificationUrl={resendVerificationUrl}
          resendTitle={copy.resendTitle}
          resendDescription={copy.resendDescription}
          emailLabel={copy.emailLabel}
          resendSendingLabel={copy.resendSending}
          resendButtonLabel={copy.resendButton}
          openVerificationLinkLabel={copy.openVerificationLink}
          goToLoginLabel={copy.goToLogin}
          onEmailChange={setEmailForResend}
          onSubmit={resend}
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
