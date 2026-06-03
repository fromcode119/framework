"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminComponent } from '@/components/admin-component';
import type { ForgotPasswordPageState } from './forgot-password-page.interfaces';

export default class ForgotPasswordPage extends AdminComponent<Record<string, never>, ForgotPasswordPageState> {
  state: ForgotPasswordPageState = {
    email: '',
    isLoading: false,
    error: '',
    message: '',
  };

  private async handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    this.setState({ isLoading: true, error: '', message: '' });

    try {
      const data = await AdminApi.post(
        `${AdminConstants.ENDPOINTS.AUTH.FORGOT_PASSWORD}?context=admin`,
        { email: this.state.email, context: 'admin' },
        { headers: { 'X-Reset-Context': 'admin' } }
      );
      this.setState({ message: data?.message || 'If an account exists, a reset link has been sent.' });
    } catch (err: any) {
      this.setState({ error: err?.message || 'Unable to request password reset.' });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  render(): React.ReactElement {
    const { email, isLoading, error, message } = this.state;
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
            <p className="text-slate-500 font-medium">Recover your {AppEnv.APP_NAME} admin account</p>
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

            <form onSubmit={(event) => this.handleSubmit(event)} className="space-y-6" noValidate>
              <Input
                label="Email Address"
                placeholder="name@company.com"
                type="email"
                required
                value={email}
                onChange={(event) => this.setState({ email: event.target.value })}
              />

              <Button type="submit" className="w-full py-4 text-base" isLoading={isLoading}>
                Send Reset Link
              </Button>
            </form>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs font-semibold">
            <button onClick={() => this.router.push(AdminConstants.ROUTES.AUTH.LOGIN)} className="text-indigo-500 hover:text-indigo-400">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
}
