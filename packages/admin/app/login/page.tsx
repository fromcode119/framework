"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminConstants } from '@/lib/constants';
import { AppEnv } from '@/lib/env';
import { AuthUtils } from '@/lib/auth-utils';
import { AdminComponent } from '@/components/admin-component';
import type { LoginFieldErrors, LoginPageProps, LoginPageState } from './login-page.interfaces';

const loginInputClassName = 'bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700';
const ATLANTIS_LOGO_SLATE_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-logo-slate.png');
const ATLANTIS_LOGO_WHITE_PATH = AdminPathUtils.toAdminPath('/brand/atlantis-logo-white.png');

export default class LoginPage extends AdminComponent<LoginPageProps, LoginPageState> {
  private mounted = false;

  state: LoginPageState = {
    isLoading: false,
    isCheckingStatus: true,
    email: '',
    password: '',
    totpToken: '',
    recoveryCode: '',
    twoFactorMethod: 'totp',
    requiresTwoFactor: false,
    error: '',
    fieldErrors: {},
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const searchParams = this.props.searchParams ? await this.props.searchParams : undefined;
    if (!this.mounted) return;

    if (searchParams?.reason === 'session_expired') {
      // SELF-HEALING: Purge conflicting auth cookies only after an explicit
      // session-expired redirect instead of on every login-page visit.
      AuthUtils.purgeAuth();
    }

    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS);
      if (data.initialized === false) {
        this.router.push(AdminConstants.ROUTES.AUTH.SETUP);
      }
    } catch (err) {
      console.warn("API health check failed. Defaulting to manual login.", err);
    } finally {
      if (this.mounted) this.setState({ isCheckingStatus: false });
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private handleForgotPassword(e: React.FormEvent): void {
    e.preventDefault();
    this.router.push(AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD);
  }

  private handleContactSupport(e: React.FormEvent): void {
    e.preventDefault();
    this.runtime.notify.notify('info', 'Support Offline', 'Support portal is temporarily unavailable. Please try again later.');
  }

  private resetTwoFactor(): void {
    if (this.state.requiresTwoFactor) {
      this.setState({
        requiresTwoFactor: false,
        totpToken: '',
        recoveryCode: '',
        twoFactorMethod: 'totp',
      });
    }
  }

  private async handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    this.setState({ error: '' });
    const { email, password, requiresTwoFactor, twoFactorMethod, totpToken, recoveryCode } = this.state;
    const newFieldErrors: LoginFieldErrors = {};

    if (!email) newFieldErrors.email = 'Required';
    if (!password) newFieldErrors.password = 'Required';
    if (requiresTwoFactor && twoFactorMethod === 'totp' && !totpToken.trim()) newFieldErrors.totpToken = 'Required';
    if (requiresTwoFactor && twoFactorMethod === 'recovery' && !recoveryCode.trim()) newFieldErrors.recoveryCode = 'Required';

    if (Object.keys(newFieldErrors).length > 0) {
      this.setState({ fieldErrors: newFieldErrors });
      return;
    }

    this.setState({ fieldErrors: {}, isLoading: true });

    try {
      const payload: Record<string, string> = { email, password };
      if (requiresTwoFactor && twoFactorMethod === 'totp' && totpToken.trim()) {
        payload.totpToken = totpToken.trim();
      }
      if (requiresTwoFactor && twoFactorMethod === 'recovery' && recoveryCode.trim()) {
        payload.recoveryCode = recoveryCode.trim();
      }

      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.LOGIN, payload);

      if (data?.requiresTwoFactor) {
        this.setState({ requiresTwoFactor: true, twoFactorMethod: 'totp', error: '' });
        return;
      }

      if (!data?.token || !data?.user) {
        throw new Error('Login response is missing session data.');
      }

      this.setState({ requiresTwoFactor: false, totpToken: '', recoveryCode: '' });
      this.auth.login(data.token, data.user);
    } catch (err: any) {
      this.setState({ error: err.message || 'Login failed. Please check your credentials.' });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  render(): React.ReactElement {
    const {
      isLoading,
      isCheckingStatus,
      email,
      password,
      totpToken,
      recoveryCode,
      twoFactorMethod,
      requiresTwoFactor,
      error,
      fieldErrors,
    } = this.state;

    if (isCheckingStatus) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin text-indigo-600">
               <FrameworkIcons.Loader size={40} />
            </div>
            <span className="text-xs font-semibold text-slate-500 tracking-wide">Verifying...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#020617]">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center mb-10">
            <div className="mb-6 inline-flex items-center justify-center px-5 py-4 ">
              <img
                src={ATLANTIS_LOGO_SLATE_PATH}
                alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
                className="h-auto w-[220px] dark:hidden"
              />
              <img
                src={ATLANTIS_LOGO_WHITE_PATH}
                alt={`${AppEnv.APP_NAME} by ${AppEnv.COMPANY_NAME} logo`}
                className="hidden h-auto w-[220px] dark:block"
              />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-white">
              Welcome to {AppEnv.APP_NAME}
            </h1>
            <p className="font-medium text-slate-500 dark:text-slate-300">
              Sign in to manage your {AppEnv.APP_NAME} workspace powered by {AppEnv.COMPANY_NAME}.
            </p>
          </div>

          <div className="p-8 rounded-3xl border shadow-2xl bg-white border-slate-200 dark:bg-[#0f172a] dark:border-slate-800 dark:shadow-black/40">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold animate-in fade-in zoom-in duration-300">
                {error}
              </div>
            )}
            <form onSubmit={(e) => this.handleSubmit(e)} className="space-y-6" noValidate>
              <Input
                label="Email Address"
                placeholder="name@company.com"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  this.setState({ email: e.target.value });
                  this.resetTwoFactor();
                 }}
                 error={fieldErrors.email}
                 className="group"
                 inputClassName={loginInputClassName}
               />

               <div className="space-y-1">
                 <div className="flex items-center justify-between">
                   <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Password</label>
                   <button type="button" onClick={(e) => this.handleForgotPassword(e)} className="text-xs font-semibold text-indigo-500 hover:text-indigo-400">Forgot?</button>
                 </div>
                 <Input
                  placeholder="••••••••"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    this.setState({ password: e.target.value });
                    this.resetTwoFactor();
                   }}
                   error={fieldErrors.password}
                   inputClassName={loginInputClassName}
                 />
               </div>

              {requiresTwoFactor ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={twoFactorMethod === 'totp' ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-lg"
                      onClick={() => this.setState({ twoFactorMethod: 'totp' })}
                    >
                      Authenticator Code
                    </Button>
                    <Button
                      type="button"
                      variant={twoFactorMethod === 'recovery' ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-lg"
                      onClick={() => this.setState({ twoFactorMethod: 'recovery' })}
                    >
                      Recovery Code
                    </Button>
                  </div>
                  {twoFactorMethod === 'totp' ? (
                    <Input
                      label="2FA Code"
                      placeholder="123456"
                      type="text"
                      required
                      autoComplete="one-time-code"
                       value={totpToken}
                       onChange={(e) => this.setState({ totpToken: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                       error={fieldErrors.totpToken}
                       inputClassName={loginInputClassName}
                     />
                   ) : (
                     <Input
                      label="Recovery Code"
                      placeholder="ABCDE-12345"
                      type="text"
                      required
                       value={recoveryCode}
                       onChange={(e) => this.setState({ recoveryCode: e.target.value.toUpperCase() })}
                       error={fieldErrors.recoveryCode}
                       inputClassName={loginInputClassName}
                     />
                   )}
                 </div>
              ) : null}

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-indigo-500/10 text-indigo-500">
                    <FrameworkIcons.Shield size={14} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Secure Session</span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full py-4 text-base transform hover:scale-[1.02] active:scale-[0.98]"
                isLoading={isLoading}
              >
                {requiresTwoFactor
                  ? (twoFactorMethod === 'totp' ? 'Verify 2FA & Sign In' : 'Use Recovery Code & Sign In')
                  : 'Sign In to Portal'}
                {!isLoading && <FrameworkIcons.ArrowRight size={18} className="ml-2" />}
              </Button>
            </form>
          </div>

          <p className="text-center mt-8 text-sm text-slate-500">
            Not part of the organization? <button onClick={(e) => this.handleContactSupport(e)} className="font-semibold text-indigo-500 hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">Contact Support</button>
          </p>
        </div>
      </div>
    );
  }
}
