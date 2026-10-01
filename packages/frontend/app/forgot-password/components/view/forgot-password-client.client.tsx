import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import { Reactor, state, bound, prop } from '@fromcode119/react-class-components';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';
import { FrontendAuthRequestHeaders } from '@/lib/frontend-auth-request-headers';

export class ForgotPasswordPage extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @state email = '';
  @state isSubmitting = false;
  @state error = '';
  @state message = '';

  @bound async handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    this.isSubmitting = true;
    this.error = '';
    this.message = '';

    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD, { context: 'frontend' }), {
        method: 'POST',
        credentials: 'include',
        headers: FrontendAuthRequestHeaders.json({ 'X-Reset-Context': 'frontend' }),
        body: JSON.stringify({ email: this.email, context: 'frontend' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to request password reset.');
      }
      this.message = payload?.message || 'If an account exists, a password reset link has been sent.';
    } catch (err: any) {
      this.error = err?.message || 'Failed to request password reset.';
    } finally {
      this.isSubmitting = false;
    }
  }

  render() {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight">{FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.forgotPassword')}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.enterYourEmailAndWe')}
          </p>

          <form onSubmit={this.handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {this.error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{this.error}</div>
            ) : null}
            {this.message ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <p>{this.message}</p>
              </div>
            ) : null}

            <label className="block text-sm font-semibold">
              {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.email')}
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={this.email}
                onChange={(event) => (this.email = event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <button
              type="submit"
              disabled={this.isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {this.isSubmitting ? FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.sending') : FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.sendResetLink')}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.needAccountVerification')}{' '}
            <Link href="/verify-email" className="font-semibold text-indigo-600 hover:underline">
              {FrontendCopy.t(this.locale, 'frontend.forgotPasswordClient.verifyEmail')}
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
