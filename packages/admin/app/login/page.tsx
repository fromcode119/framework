"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AuthUtils } from '@/lib/auth-utils';
import { AdminComponent } from '@/components/admin-component';
import { LoginForm } from './login-form';
import { LoginPageHeader } from './login-page-header';
import type { LoginFieldErrors, LoginPageProps, LoginPageState } from './login-page.interfaces';

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
          <LoginPageHeader />

          <LoginForm
            email={email}
            password={password}
            totpToken={totpToken}
            recoveryCode={recoveryCode}
            twoFactorMethod={twoFactorMethod}
            requiresTwoFactor={requiresTwoFactor}
            isLoading={isLoading}
            error={error}
            fieldErrors={fieldErrors}
            onSubmit={(e) => this.handleSubmit(e)}
            onEmailChange={(value) => { this.setState({ email: value }); this.resetTwoFactor(); }}
            onPasswordChange={(value) => { this.setState({ password: value }); this.resetTwoFactor(); }}
            onForgotPassword={(e) => this.handleForgotPassword(e)}
            onSelectTwoFactorMethod={(method) => this.setState({ twoFactorMethod: method })}
            onTotpTokenChange={(value) => this.setState({ totpToken: value })}
            onRecoveryCodeChange={(value) => this.setState({ recoveryCode: value })}
          />

          <p className="text-center mt-8 text-sm text-slate-500">
            Not part of the organization? <button onClick={(e) => this.handleContactSupport(e)} className="font-semibold text-indigo-500 hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">Contact Support</button>
          </p>
        </div>
      </div>
    );
  }
}
