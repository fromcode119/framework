"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/sdk';
import { FrontendApiRoutes } from '@/lib/api-routes';
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    if (!token) {
      setError('Reset token is required.');
      setIsSubmitting(false);
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      setIsSubmitting(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.RESET_PASSWORD), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          token,
          newPassword
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to reset password.');
      }
      setMessage(payload?.message || 'Password has been reset. You can now sign in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}
          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
          ) : null}

          <label className="block text-sm font-semibold">
            Reset Token
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste reset token"
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              New Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Confirm Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Need a new token?{' '}
          <Link href="/forgot-password" className="font-semibold text-indigo-600 hover:underline">
            Request reset link
          </Link>
        </p>
      </div>
    </main>
  );
}
