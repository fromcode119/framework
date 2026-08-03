import type { ChangeEvent, FormEvent } from 'react';
import { Reactor, state, bound } from '@fromcode119/reactor';
import Link from 'next/link';
import { SystemConstants } from '@fromcode119/core/client';
import { FrontendApiRoutes } from '@/lib/api-routes';

export class RegisterPage extends Reactor {
  @state firstName = '';
  @state lastName = '';
  @state email = '';
  @state password = '';
  @state confirmPassword = '';
  @state isSubmitting = false;
  @state error = '';
  @state successMessage = '';
  @state verificationUrl = '';
  @state checkoutContext = {
    checkoutSessionId: '',
    cartId: '',
    orderId: ''
  };

  componentDidMount(): void {
    const query = new URLSearchParams(window.location.search);
    this.checkoutContext = {
      checkoutSessionId: query.get('checkoutSessionId') || query.get('checkout_session') || '',
      cartId: query.get('cartId') || query.get('cart_id') || '',
      orderId: query.get('orderId') || query.get('order_id') || ''
    };
  }

  @bound onFirstNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.firstName = event.target.value;
  }

  @bound onLastNameChange(event: ChangeEvent<HTMLInputElement>): void {
    this.lastName = event.target.value;
  }

  @bound onEmailChange(event: ChangeEvent<HTMLInputElement>): void {
    this.email = event.target.value;
  }

  @bound onPasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    this.password = event.target.value;
  }

  @bound onConfirmPasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    this.confirmPassword = event.target.value;
  }

  @bound async handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    this.error = '';
    this.successMessage = '';
    this.verificationUrl = '';

    if (!this.email.trim()) {
      this.error = 'Email is required.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.isSubmitting = true;
    try {
      const response = await fetch(FrontendApiRoutes.buildFrontendApiUrl(SystemConstants.API_PATH.AUTH.REGISTER), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Framework-Client': 'frontend-ui',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          firstName: this.firstName,
          lastName: this.lastName,
          email: this.email,
          password: this.password,
          context: this.checkoutContext
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Registration failed.');
      }

      this.successMessage = payload?.message || 'Registration successful. Check your email to verify your account.';
      if (payload?.verificationUrl) {
        this.verificationUrl = String(payload.verificationUrl);
      }
    } catch (err: any) {
      this.error = err?.message || 'Registration failed.';
    } finally {
      this.isSubmitting = false;
    }
  }

  render() {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Register to track purchases and manage customer access.
          </p>

          <form onSubmit={this.handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {this.error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{this.error}</div>
            ) : null}

            {this.successMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <p>{this.successMessage}</p>
                {this.verificationUrl ? (
                  <p className="mt-2">
                    <a href={this.verificationUrl} className="font-semibold underline" target="_blank" rel="noopener noreferrer">
                      Open verification link
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                First Name
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.firstName}
                  onChange={this.onFirstNameChange}
                  placeholder="John"
                />
              </label>
              <label className="text-sm font-semibold">
                Last Name
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.lastName}
                  onChange={this.onLastNameChange}
                  placeholder="Doe"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={this.email}
                onChange={this.onEmailChange}
                placeholder="you@example.com"
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.password}
                  onChange={this.onPasswordChange}
                  placeholder="Min. 8 characters"
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                Confirm Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  value={this.confirmPassword}
                  onChange={this.onConfirmPasswordChange}
                  placeholder="Repeat password"
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={this.isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {this.isSubmitting ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            Already registered?{' '}
            <Link href="/verify-email" className="font-semibold text-indigo-600 hover:underline">
              Verify email
            </Link>
          </p>
        </div>
      </main>
    );
  }
}
