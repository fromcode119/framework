"use client";

import Link from 'next/link';

export default function VerifyEmailVerificationCard({
  token,
  status,
  message,
  verificationTokenLabel,
  verificationTokenPlaceholder,
  verifyingLabel,
  verifyButtonLabel,
  goToLoginLabel,
  verificationErrorNote,
  onTokenChange,
  onVerify,
}: {
  token: string;
  status: 'idle' | 'verifying' | 'success' | 'error';
  message: string;
  verificationTokenLabel: string;
  verificationTokenPlaceholder: string;
  verifyingLabel: string;
  verifyButtonLabel: string;
  goToLoginLabel: string;
  verificationErrorNote: string;
  onTokenChange: (value: string) => void;
  onVerify: () => void;
}) {
  return (
    <div className="fc-auth-card fc-auth-card-primary">
      <label className="fc-auth-field">
        <span className="fc-auth-field-label">{verificationTokenLabel}</span>
        <input
          className="fc-auth-input"
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder={verificationTokenPlaceholder}
        />
      </label>

      <button
        type="button"
        onClick={onVerify}
        disabled={status === 'verifying'}
        className="fc-auth-button fc-auth-button-primary"
      >
        {status === 'verifying' ? verifyingLabel : verifyButtonLabel}
      </button>

      {message ? (
        <div
          className={`fc-auth-alert ${
            status === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : status === 'error'
                ? 'border border-rose-200 bg-rose-50 text-rose-700'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      {status === 'success' ? (
        <p className="fc-auth-card-link-row">
          <Link href="/login" className="fc-auth-inline-link">
            {goToLoginLabel}
          </Link>
        </p>
      ) : null}

      {status === 'error' ? (
        <p className="fc-auth-card-note">
          {verificationErrorNote}
        </p>
      ) : null}
    </div>
  );
}
