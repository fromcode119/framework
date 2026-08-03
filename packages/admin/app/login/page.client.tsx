import { TwoFactorMethod } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { FormEvent, ReactElement } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AuthUtils } from '@/lib/auth-utils';
import { AdminComponent } from '@/components/view/admin-component.client';
import { LoginForm } from '@/app/login/login-form';
import { LoginPageHeader } from '@/app/login/login-page-header';
import { prop, state } from '@fromcode119/reactor';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';

export class LoginPage extends AdminComponent {
  @prop declare searchParams?: Promise<Record<string, string | string[]>>;

  @state isLoading = false;
  @state isCheckingStatus = true;
  @state email = '';
  @state password = '';
  @state totpToken = '';
  @state recoveryCode = '';
  @state twoFactorMethod: TwoFactorMethod = TwoFactorMethod.TOTP;
  @state requiresTwoFactor = false;
  @state error = '';
  @state fieldErrors: ILoginFieldErrors = {};

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const searchParams = this.searchParams ? await this.searchParams : undefined;
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
      if (this.mounted) this.isCheckingStatus = false;
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private handleForgotPassword(e: FormEvent): void {
    e.preventDefault();
    this.router.push(AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD);
  }

  private handleContactSupport(e: FormEvent): void {
    e.preventDefault();
    this.runtime.notify.notify(NotificationType.INFO, 'Support Offline', 'Support portal is temporarily unavailable. Please try again later.');
  }

  private resetTwoFactor(): void {
    if (this.requiresTwoFactor) {
      this.requiresTwoFactor = false;
      this.totpToken = '';
      this.recoveryCode = '';
      this.twoFactorMethod = TwoFactorMethod.TOTP;
    }
  }

  private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    this.error = '';
    const { email, password, requiresTwoFactor, twoFactorMethod, totpToken, recoveryCode } = this;
    const newFieldErrors: ILoginFieldErrors = {};

    if (!email) newFieldErrors.email = 'Required';
    if (!password) newFieldErrors.password = 'Required';
    if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.TOTP && !totpToken.trim()) newFieldErrors.totpToken = 'Required';
    if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.RECOVERY && !recoveryCode.trim()) newFieldErrors.recoveryCode = 'Required';

    if (Object.keys(newFieldErrors).length > 0) {
      this.fieldErrors = newFieldErrors;
      return;
    }

    this.fieldErrors = {};
    this.isLoading = true;

    try {
      const payload: Record<string, string> = { email, password };
      if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.TOTP && totpToken.trim()) {
        payload.totpToken = totpToken.trim();
      }
      if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.RECOVERY && recoveryCode.trim()) {
        payload.recoveryCode = recoveryCode.trim();
      }

      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.LOGIN, payload);

      if (data?.requiresTwoFactor) {
        this.requiresTwoFactor = true;
        this.twoFactorMethod = TwoFactorMethod.TOTP;
        this.error = '';
        return;
      }

      if (!data?.token || !data?.user) {
        throw new Error('Login response is missing session data.');
      }

      this.requiresTwoFactor = false;
      this.totpToken = '';
      this.recoveryCode = '';
      this.auth.login(data.token, data.user);
    } catch (err: any) {
      this.error = err.message || 'Login failed. Please check your credentials.';
    } finally {
      this.isLoading = false;
    }
  }

  render(): ReactElement {
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
    } = this;

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
            onEmailChange={(value) => { this.email = value; this.resetTwoFactor(); }}
            onPasswordChange={(value) => { this.password = value; this.resetTwoFactor(); }}
            onForgotPassword={(e) => this.handleForgotPassword(e)}
            onSelectTwoFactorMethod={(method) => { this.twoFactorMethod = method; }}
            onTotpTokenChange={(value) => { this.totpToken = value; }}
            onRecoveryCodeChange={(value) => { this.recoveryCode = value; }}
          />

          <p className="text-center mt-8 text-sm text-slate-500">
            Not part of the organization? <button onClick={(e) => this.handleContactSupport(e)} className="font-semibold text-indigo-500 hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">Contact Support</button>
          </p>
        </div>
      </div>
    );
  }
}
