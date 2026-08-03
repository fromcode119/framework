import type { FormEvent, ReactElement } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

export class ResetPasswordPage extends AdminComponent {
  @state token = '';
  @state newPassword = '';
  @state confirmPassword = '';
  @state isLoading = false;
  @state error = '';
  @state message = '';

  componentDidMount(): void {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = String(params.get('token') || '').trim();
    if (fromUrl) this.token = fromUrl;
  }

  private async handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    this.isLoading = true;
    this.error = '';
    this.message = '';

    const token = this.token;
    const newPassword = this.newPassword;
    const confirmPassword = this.confirmPassword;

    if (!token) {
      this.error = 'Reset token is required.';
      this.isLoading = false;
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      this.isLoading = false;
      return;
    }
    if (newPassword !== confirmPassword) {
      this.error = 'Passwords do not match.';
      this.isLoading = false;
      return;
    }

    try {
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword });
      this.message = data?.message || 'Password reset successful. You can sign in now.';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      this.error = err?.message || 'Unable to reset password.';
    } finally {
      this.isLoading = false;
    }
  }

  render(): ReactElement {
    const token = this.token;
    const newPassword = this.newPassword;
    const confirmPassword = this.confirmPassword;
    const isLoading = this.isLoading;
    const error = this.error;
    const message = this.message;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#020617]">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-xl shadow-xl shadow-indigo-600/30 mb-6">
              <FrameworkIcons.ShieldCheck size={30} className="text-white" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
              Set New Password
            </h1>
            <p className="text-slate-500 font-medium">Update your {AppEnv.APP_NAME} credentials</p>
          </div>

          <div className={`p-8 ${AdminClass.SURFACE}`}>
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
                onChange={(event) => { this.token = event.target.value; }}
              />
              <Input
                label="New Password"
                placeholder="••••••••"
                type="password"
                required
                value={newPassword}
                onChange={(event) => { this.newPassword = event.target.value; }}
              />
              <Input
                label="Confirm Password"
                placeholder="••••••••"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => { this.confirmPassword = event.target.value; }}
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
