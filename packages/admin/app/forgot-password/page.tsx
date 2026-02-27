"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ENDPOINTS, ROUTES } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { APP_NAME } from '@/lib/env';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await api.post(
        `${ENDPOINTS.AUTH.FORGOT_PASSWORD}?context=admin`,
        { email, context: 'admin' },
        { headers: { 'X-Reset-Context': 'admin' } }
      );
      setMessage(data?.message || 'If an account exists, a reset link has been sent.');
    } catch (err: any) {
      setError(err?.message || 'Unable to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#020617]">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 mb-6">
            <FrameworkIcons.Lock size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
            Reset Access
          </h1>
          <p className="text-slate-500 font-medium">Recover your {APP_NAME} admin account</p>
        </div>

        <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
          {error ? (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <p>{message}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
              label="Email Address"
              placeholder="name@company.com"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Button type="submit" className="w-full py-4 text-base" isLoading={isLoading}>
              Send Reset Link
            </Button>
          </form>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs font-semibold">
          <button onClick={() => router.push(ROUTES.AUTH.LOGIN)} className="text-indigo-500 hover:text-indigo-400">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
