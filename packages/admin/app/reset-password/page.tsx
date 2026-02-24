"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { ENDPOINTS } from '../../lib/constants';
import { FrameworkIcons } from '../../lib/icons';
import { APP_NAME } from '../../lib/env';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('token') || '').trim();
    if (fromUrl) setToken(fromUrl);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (!token) {
      setError('Reset token is required.');
      setIsLoading(false);
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword });
      setMessage(data?.message || 'Password reset successful. You can sign in now.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#020617]">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 mb-6">
            <FrameworkIcons.ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
            Set New Password
          </h1>
          <p className="text-slate-500 font-medium">Update your {APP_NAME} credentials</p>
        </div>

        <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
          {error ? (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
              label="Reset Token"
              placeholder="Paste reset token"
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <Input
              label="New Password"
              placeholder="••••••••"
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <Input
              label="Confirm Password"
              placeholder="••••••••"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />

            <Button type="submit" className="w-full py-4 text-base" isLoading={isLoading}>
              Update Password
            </Button>
          </form>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs font-semibold">
          <button onClick={() => router.push('/login')} className="text-indigo-500 hover:text-indigo-400">
            Back to Login
          </button>
          <Link href="/forgot-password" className="text-slate-400 hover:text-slate-300">
            Need new link?
          </Link>
        </div>
      </div>
    </div>
  );
}
