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
import { LoginShell } from '@/app/login/login-shell';
import type { ILoginHelp } from '@/app/login/interfaces/login-help.interface';
import { prop, state } from '@fromcode119/react-class-components';
import type { ILoginFieldErrors } from '@/app/login/interfaces/login-field-errors.interface';
import type { ILoginController } from '@/lib/appearance/interfaces/login-controller.interface';
import { AdminPageKeys } from '@/lib/appearance/admin-page-keys';
import { AdminPageRegistry } from '@/lib/appearance/admin-page-registry';
import { HostInfoClient } from '@/lib/tenants/host-info-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
  /** Whose console this domain is, asked publicly so a custom sign-in can name it before anyone signs in. */
  @state workspace: { slug: string; appearance: string } | null = null;
  /** Settings → General → Platform name; '' until the host answers, or when the operator cleared it. */
  @state platformName = '';

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    void HostInfoClient.workspace().then((workspace) => { if (this.mounted) this.workspace = workspace; });
    void HostInfoClient.platformName().then((name) => { if (this.mounted) this.platformName = name; });
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

  private handleForgotPassword(): void {
    this.router.push(AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD);
  }

  /** Leaves the code step for the email and password again, keeping what was typed there. */
  private backToPassword(): void {
    this.error = '';
    this.fieldErrors = {};
    this.resetTwoFactor();
  }

  /** The words above the form. A workspace domain names the workspace; otherwise the platform's own name. */
  private get heading(): { title: string; subtitle: string } {
    if (this.requiresTwoFactor) {
      return { title: AdminI18n.t('login.twoFactor.title'), subtitle: AdminI18n.t(this.twoFactorMethod === TwoFactorMethod.TOTP ? 'login.twoFactor.subtitle' : 'login.twoFactor.recoverySubtitle') };
    }
    return this.greeting;
  }

  /** The greeting on the first step — also handed to an appearance that draws its own sign-in. */
  private get greeting(): { title: string; subtitle: string } {
    const workspace = this.workspace;
    if (workspace) {
      return {
        title: AdminI18n.t('login.signInTo', { name: workspace.slug }),
        subtitle: AdminI18n.t('login.workspaceIntro', { name: workspace.slug, console: workspace.appearance || AdminI18n.t('login.defaultConsole') }),
      };
    }
    return {
      title: AdminI18n.t('login.welcomeBack'),
      subtitle: this.platformName ? AdminI18n.t('login.consoleIntro', { platform: this.platformName }) : AdminI18n.t('login.consoleIntroUnnamed'),
    };
  }

  /** What the help column says at this step. */
  private get help(): ILoginHelp {
    const items = (prefix: string) => [1, 2, 3].map((n) => AdminI18n.optional(`${prefix}.item${n}`)).filter(Boolean);
    if (this.requiresTwoFactor) return { title: AdminI18n.t('login.help.twoFactor.title'), items: items('login.help.twoFactor') };
    if (this.error) return { title: AdminI18n.t('login.help.failed.title'), items: items('login.help.failed') };
    return { title: AdminI18n.t('login.help.signIn.title'), text: AdminI18n.t('login.help.signIn.text') };
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

    if (!email) newFieldErrors.email = AdminI18n.t('common.required');
    if (!password) newFieldErrors.password = AdminI18n.t('common.required');
    if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.TOTP && !totpToken.trim()) newFieldErrors.totpToken = AdminI18n.t('common.required');
    if (requiresTwoFactor && twoFactorMethod === TwoFactorMethod.RECOVERY && !recoveryCode.trim()) newFieldErrors.recoveryCode = AdminI18n.t('common.required');

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
      this.error = err.message || AdminI18n.t('login.failed');
    } finally {
      this.isLoading = false;
    }
  }

  /** The sign-in, as an appearance sees it. See `ILoginController` for what is deliberately absent. */
  private get controller(): ILoginController {
    const workspace = this.workspace;
    return {
      email: this.email,
      password: this.password,
      setEmail: (value: string) => { this.email = value; this.resetTwoFactor(); },
      setPassword: (value: string) => { this.password = value; this.resetTwoFactor(); },
      submit: (event?: FormEvent) => { event?.preventDefault(); void this.handleSubmit(event ?? ({ preventDefault() {} } as unknown as FormEvent)); },
      forgotPassword: () => { this.router.push(AdminConstants.ROUTES.AUTH.FORGOT_PASSWORD); },
      contactSupport: () => { this.runtime.notify.notify(NotificationType.INFO, AdminI18n.t('login.supportOfflineTitle'), AdminI18n.t('login.supportOffline')); },
      isLoading: this.isLoading,
      error: this.error,
      fieldErrors: this.fieldErrors,
      requiresTwoFactor: this.requiresTwoFactor,
      twoFactorMethod: this.twoFactorMethod,
      totpToken: this.totpToken,
      recoveryCode: this.recoveryCode,
      setTwoFactorMethod: (method) => { this.twoFactorMethod = method; },
      setTotpToken: (value: string) => { this.totpToken = value; },
      setRecoveryCode: (value: string) => { this.recoveryCode = value; },
      workspace: workspace?.slug || '',
      title: this.greeting.title,
      subtitle: this.greeting.subtitle,
    };
  }

  render(): ReactElement {
    if (this.isCheckingStatus) {
      return (
        <div className="fc-login" role="status" aria-label={AdminI18n.t('login.checking')}>
          <FrameworkIcons.Loader size={32} className="fc-login__spinner" aria-hidden="true" />
        </div>
      );
    }

    // An appearance may render the WHOLE sign-in from the controller — its own layout, panel, inputs
    // and button — because no arrangement of slots reaches the designs people actually ask for. What
    // it cannot do is authenticate: `submit` is this page's own post to `/auth/login`, the 2FA
    // challenge and the redirect stay here, and the gate renders this only for a visitor with no
    // session. See `ILoginController`.
    const CustomLogin = AdminPageRegistry.shared.resolve(this.workspace?.appearance || '', AdminPageKeys.LOGIN_FRAME);
    if (CustomLogin) return <CustomLogin login={this.controller} />;

    const heading = this.heading;
    return (
      <LoginShell help={this.help}>
        <LoginPageHeader title={heading.title} subtitle={heading.subtitle} />
        <LoginForm
          email={this.email}
          password={this.password}
          totpToken={this.totpToken}
          recoveryCode={this.recoveryCode}
          twoFactorMethod={this.twoFactorMethod}
          requiresTwoFactor={this.requiresTwoFactor}
          isLoading={this.isLoading}
          error={this.error}
          fieldErrors={this.fieldErrors}
          onSubmit={(e) => this.handleSubmit(e)}
          onEmailChange={(value) => { this.email = value; }}
          onPasswordChange={(value) => { this.password = value; }}
          onForgotPassword={() => this.handleForgotPassword()}
          onSelectTwoFactorMethod={(method) => { this.twoFactorMethod = method; this.fieldErrors = {}; }}
          onTotpTokenChange={(value) => { this.totpToken = value; }}
          onRecoveryCodeChange={(value) => { this.recoveryCode = value; }}
          onBackToPassword={() => this.backToPassword()}
        />
        {this.requiresTwoFactor ? null : (
          <p className="fc-login__foot">
            {this.platformName ? AdminI18n.t('login.noAccess', { platform: this.platformName }) : AdminI18n.t('login.noAccessUnnamed')}
          </p>
        )}
      </LoginShell>
    );
  }
}
