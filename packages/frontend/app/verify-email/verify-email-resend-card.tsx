"use client";

import Link from 'next/link';

export default function VerifyEmailResendCard({
  email,
  isResending,
  resendMessage,
  resendStatus,
  resendVerificationUrl,
  resendTitle,
  resendDescription,
  emailLabel,
  resendSendingLabel,
  resendButtonLabel,
  openVerificationLinkLabel,
  goToLoginLabel,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  isResending: boolean;
  resendMessage: string;
  resendStatus: 'idle' | 'success' | 'error';
  resendVerificationUrl: string;
  resendTitle: string;
  resendDescription: string;
  emailLabel: string;
  resendSendingLabel: string;
  resendButtonLabel: string;
  openVerificationLinkLabel: string;
  goToLoginLabel: string;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="fc-auth-card fc-auth-card-secondary">
      <h2 className="fc-auth-secondary-title">{resendTitle}</h2>
      <p className="fc-auth-secondary-copy">{resendDescription}</p>
      <label className="fc-auth-field">
        <span className="fc-auth-field-label">{emailLabel}</span>
        <input
          type="email"
          className="fc-auth-input"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <button
        type="submit"
        disabled={isResending}
        className="fc-auth-button fc-auth-button-secondary"
      >
        {isResending ? resendSendingLabel : resendButtonLabel}
      </button>

      {resendMessage ? (
        <div
          className={`fc-auth-alert ${
            resendStatus === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <p>{resendMessage}</p>
          {resendVerificationUrl ? (
            <p className="fc-auth-card-link-row">
              <a
                href={resendVerificationUrl}
                className="fc-auth-inline-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {openVerificationLinkLabel}
              </a>
            </p>
          ) : null}
          {resendStatus === 'success' ? (
            <p className="fc-auth-card-link-row">
              <Link href="/login" className="fc-auth-inline-link">
                {goToLoginLabel}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
