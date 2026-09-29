import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Reactor, state, bound, prop } from '@fromcode119/react-class-components';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';

export class ResetPasswordPage extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @state token = '';
  @state newPassword = '';
  @state confirmPassword = '';
  @state isSubmitting = false;
  @state error = '';
  @state message = '';

  componentDidMount(): void {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) this.token = tokenFromUrl;
  }

  @bound
  protected onTokenChange(event: ChangeEvent<HTMLInputElement>): void {
    this.token = event.target.value;
  }

  @bound
  protected onNewPasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    this.newPassword = event.target.value;
  }

  @bound
  protected onConfirmPasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    this.confirmPassword = event.target.value;
  }

  @bound
  protected async handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    this.isSubmitting = true;
    this.error = '';
    this.message = '';

    if (!this.token) {
      this.error = 'Reset token is required.';
      this.isSubmitting = false;
      return;
    }
    if (!this.newPassword || this.newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      this.isSubmitting = false;
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      this.isSubmitting = false;
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
          token: this.token,
          newPassword: this.newPassword
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to reset password.');
      }
      this.message = payload?.message || 'Password has been reset. You can now sign in.';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      this.error = err?.message || 'Failed to reset password.';
    } finally {
      this.isSubmitting = false;
    }
  }

  render(): ReactNode {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight">{FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.resetPassword')}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.setANewPasswordFor')}
          </p>

          <form onSubmit={this.handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {this.error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{this.error}</div>
            ) : null}
            {this.message ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{this.message}</div>
            ) : null}

            <label className="block text-sm font-semibold">
              {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.resetToken')}
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={this.token}
                onChange={this.onTokenChange}
                placeholder={FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.pasteResetToken')}
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.newPassword')}
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.newPassword}
                  onChange={this.onNewPasswordChange}
                  placeholder={FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.newPassword2')}
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.confirmPassword')}
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.confirmPassword}
                  onChange={this.onConfirmPasswordChange}
                  placeholder={FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.repeatPassword')}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={this.isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {this.isSubmitting ? FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.updating') : FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.resetPassword')}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.needANewToken')}{' '}
            <Link href="/forgot-password" className="font-semibold text-indigo-600 hover:underline">
              {FrontendCopy.t(this.locale, 'frontend.resetPasswordClient.requestResetLink')}
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
