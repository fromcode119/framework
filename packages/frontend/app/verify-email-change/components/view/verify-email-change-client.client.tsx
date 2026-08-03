import { VerificationStatus } from '@/app/verify-email/enums/verification-status.enum';
import { Reactor, state, bound } from '@fromcode119/reactor';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';

export class VerifyEmailChangePage extends Reactor {
  @state token = '';
  @state status: VerificationStatus = VerificationStatus.IDLE;
  @state message = '';

  @bound async confirmChange(value: string): Promise<void> {
    if (!value) {
      this.status = VerificationStatus.ERROR;
      this.message = 'Email change token is required.';
      return;
    }

    this.status = VerificationStatus.VERIFYING;
    this.message = '';
    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ token: value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to confirm email change.');
      }
      this.status = VerificationStatus.SUCCESS;
      this.message = payload?.message || 'Email changed successfully. Please sign in again.';
    } catch (err: any) {
      this.status = VerificationStatus.ERROR;
      this.message = err?.message || 'Failed to confirm email change.';
    }
  }

  componentDidMount(): void {
    const tokenFromUrl = String(new URLSearchParams(window.location.search).get('token') || '').trim();
    if (tokenFromUrl) {
      this.token = tokenFromUrl;
      this.confirmChange(tokenFromUrl);
    }
  }

  render() {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight">Confirm Email Change</h1>
          <p className="mt-2 text-sm text-slate-600">
            Finalize your account email update.
          </p>

          <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-semibold">
              Token
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={this.token}
                onChange={(event) => (this.token = event.target.value)}
                placeholder="Paste email-change token"
              />
            </label>

            <button
              type="button"
              onClick={() => this.confirmChange(this.token)}
              disabled={this.status === VerificationStatus.VERIFYING}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {this.status === VerificationStatus.VERIFYING ? 'Confirming...' : 'Confirm Email Change'}
            </button>

            {this.message ? (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  this.status === VerificationStatus.SUCCESS
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : this.status === VerificationStatus.ERROR
                      ? 'border border-rose-200 bg-rose-50 text-rose-700'
                      : 'border border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {this.message}
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Need password help?{' '}
            <Link href="/forgot-password" className="font-semibold text-indigo-600 hover:underline">
              Reset password
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
