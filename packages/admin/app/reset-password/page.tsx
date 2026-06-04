"use client";

import React from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminComponent } from '@/components/admin-component';
import type { ResetPasswordPageState } from './reset-password-page.interfaces';

export default class ResetPasswordPage extends AdminComponent<Record<string, never>, ResetPasswordPageState> {
  state: ResetPasswordPageState = {
    token: '',
    newPassword: '',
    confirmPassword: '',
    isLoading: false,
    error: '',
    message: '',
  };

  componentDidMount(): void {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('token') || '').trim();
    if (fromUrl) this.setState({ token: fromUrl });
  }

  private async handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    this.setState({ isLoading: true, error: '', message: '' });

    const { token, newPassword, confirmPassword } = this.state;

    if (!token) {
      this.setState({ error: 'Reset token is required.', isLoading: false });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      this.setState({ error: 'Password must be at least 8 characters.', isLoading: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setState({ error: 'Passwords do not match.', isLoading: false });
      return;
    }

    try {
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword });
      this.setState({
        message: data?.message || 'Password reset successful. You can sign in now.',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      this.setState({ error: err?.message || 'Unable to reset password.' });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  render(): React.ReactElement {
    const { token, newPassword, confirmPassword, isLoading, error, message } = this.state;
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
            <p className="text-slate-500 font-medium">Update your {AppEnv.APP_NAME} credentials</p>
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

            <form onSubmit={(event) => this.handleSubmit(event)} className="space-y-6" noValidate>
              <Input
                label="Reset Token"
                placeholder="Paste reset token"
                type="text"
                required
                value={token}
                onChange={(event) => this.setState({ token: event.target.value })}
              />
              <Input
                label="New Password"
                placeholder="••••••••"
                type="password"
                required
                value={newPassword}
                onChange={(event) => this.setState({ newPassword: event.target.value })}
              />
              <Input
                label="Confirm Password"
                placeholder="••••••••"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => this.setState({ confirmPassword: event.target.value })}
              />

              <Button type="submit" className="w-full py-4 text-base" isLoading={isLoading}>
                Update Password
              </Button>
            </form>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs font-semibold">
            <button onClick={() => this.router.push(AdminConstants.ROUTES.AUTH.LOGIN)} className="text-indigo-500 hover:text-indigo-400">
              Back to Login
            </button>
            <Link href={AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD} className="text-slate-400 hover:text-slate-300">
              Need new link?
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
