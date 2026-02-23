"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiPath } from '@fromcode/sdk';
import { buildFrontendApiUrl } from '../../lib/api-routes';
export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [emailForResend, setEmailForResend] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  const verify = async (tokenValue: string) => {
    if (!tokenValue) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    setStatus('verifying');
    setMessage('');
    try {
      const response = await fetch(buildFrontendApiUrl(ApiPath.AUTH.VERIFY_EMAIL), {
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
        throw new Error(payload?.error || payload?.message || 'Verification failed.');
      }
      setStatus('success');
      setMessage(payload?.message || 'Email verified successfully.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Verification failed.');
    }
  };

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsResending(true);
    try {
      const response = await fetch(buildFrontendApiUrl(ApiPath.AUTH.RESEND_VERIFICATION), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ email: emailForResend })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Unable to resend verification email.');
      }
      setMessage(payload?.message || 'Verification email sent.');
    } catch (err: any) {
      setMessage(err?.message || 'Unable to resend verification email.');
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Verify Email</h1>
        <p className="mt-2 text-sm text-slate-600">
          Confirm your account email to unlock customer sign-in.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold">
            Verification Token
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste verification token"
            />
          </label>

          <button
            type="button"
            onClick={() => verify(token)}
            disabled={status === 'verifying'}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'verifying' ? 'Verifying...' : 'Verify Email'}
          </button>

          {message ? (
            <div
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
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
        </div>

        <form onSubmit={resend} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Didn’t receive your email?</h2>
          <p className="mt-1 text-xs text-slate-600">Enter your email and we’ll send another verification link.</p>
          <label className="mt-3 block text-sm font-semibold">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={emailForResend}
              onChange={(event) => setEmailForResend(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <button
            type="submit"
            disabled={isResending}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Need an account first?{' '}
          <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
