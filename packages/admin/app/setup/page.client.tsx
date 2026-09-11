import type { FormEvent, ReactElement } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { bound, state } from '@fromcode119/react-class-components';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { TimezoneUtils } from '@/lib/timezone';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';
import { SetupChecking } from '@/app/setup/setup-checking.client';
import { SetupFrame } from '@/app/setup/setup-frame.client';
import { SetupStepper } from '@/app/setup/setup-stepper.client';
import { SetupLanguageStep } from '@/app/setup/setup-language-step.client';
import { SetupAccountStep } from '@/app/setup/setup-account-step.client';
import { SetupPlatformStep } from '@/app/setup/setup-platform-step.client';
import type { ISetupAccountErrors } from '@/app/setup/setup-account-errors.interface';
import { SetupAccountValidation } from '@/app/setup/setup-account-validation';

/**
 * The first screen a new installation ever shows: language, administrator account, platform.
 *
 * Language comes first because every word after it depends on the answer. Each value maps to a
 * setting Settings already owns and displays, and anything left blank is not written at all.
 */
export class SetupPage extends AdminComponent {
  private mounted = false;

  @state isLoading = false;
  @state isChecking = true;
  @state step: SetupStep = SetupStep.LANGUAGE;
  @state locale = AdminDictionary.FALLBACK_LOCALE;
  @state email = '';
  @state password = '';
  @state confirmPassword = '';
  @state platformName = '';
  @state timezone = '';
  @state error = '';
  @state fieldErrors: ISetupAccountErrors = {};

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.locale = this.browserLocale;
    this.timezone = TimezoneUtils.resolveSystemTimezone();
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS);
      if (data.initialized === true) this.router.push(AdminConstants.ROUTES.AUTH.LOGIN);
    } catch (err) {
      console.warn('API check failed in setup:', err);
    } finally {
      if (this.mounted) this.isChecking = false;
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /** Their browser's language when the console speaks it, otherwise the dictionary every key is written in. */
  private get browserLocale(): string {
    const preferred = String(navigator?.language || '').trim();
    return AdminDictionary.has(preferred) ? preferred.toLowerCase().split('-')[0] : AdminDictionary.FALLBACK_LOCALE;
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  @bound
  handleLocaleChange(locale: string): void {
    this.locale = locale;
    document.documentElement.lang = locale;
  }

  @bound handleEmailChange(value: string): void { this.email = value; }
  @bound handlePasswordChange(value: string): void { this.password = value; }
  @bound handleConfirmPasswordChange(value: string): void { this.confirmPassword = value; }
  @bound handlePlatformNameChange(value: string): void { this.platformName = value; }
  @bound handleTimezoneChange(value: string): void { this.timezone = value; }

  @bound
  handleBack(): void {
    this.error = '';
    this.step = this.step.previous();
  }

  private get accountErrors(): ISetupAccountErrors {
    return SetupAccountValidation.check(this, {
      required: this.text('setup.errors.required'),
      mismatch: this.text('setup.errors.passwordMismatch'),
    });
  }

  @bound
  async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    this.error = '';

    if (this.step === SetupStep.ACCOUNT) {
      const errors = this.accountErrors;
      if (Object.keys(errors).length > 0) {
        this.fieldErrors = errors;
        return;
      }
      this.fieldErrors = {};
    }

    if (!this.step.isLast) {
      this.step = this.step.next();
      return;
    }

    await this.initialize();
  }

  private async initialize(): Promise<void> {
    this.isLoading = true;
    try {
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.SETUP, {
        email: this.email,
        password: this.password,
        locale: this.locale,
        platformName: this.platformName,
        timezone: this.timezone,
      });
      this.auth.login(data.token, data.user);
    } catch (err: any) {
      // The API owns the password policy, so its wording is the answer — never a second rule here.
      this.error = err.message || this.text('setup.errors.failed');
      this.step = SetupStep.ACCOUNT;
    } finally {
      this.isLoading = false;
    }
  }

  private get currentStep(): ReactElement {
    if (this.step === SetupStep.LANGUAGE) {
      return <SetupLanguageStep locale={this.locale} onLocaleChange={this.handleLocaleChange} />;
    }
    if (this.step === SetupStep.ACCOUNT) {
      return (
        <SetupAccountStep
          locale={this.locale}
          email={this.email}
          password={this.password}
          confirmPassword={this.confirmPassword}
          errors={this.fieldErrors}
          onEmailChange={this.handleEmailChange}
          onPasswordChange={this.handlePasswordChange}
          onConfirmPasswordChange={this.handleConfirmPasswordChange}
        />
      );
    }
    return (
      <SetupPlatformStep
        locale={this.locale}
        platformName={this.platformName}
        timezone={this.timezone}
        onPlatformNameChange={this.handlePlatformNameChange}
        onTimezoneChange={this.handleTimezoneChange}
      />
    );
  }

  render(): ReactElement {
    if (this.isChecking) return <SetupChecking locale={this.locale} />;

    return (
      <SetupFrame locale={this.locale}>
        <SetupStepper locale={this.locale} current={this.step} />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {this.text(`setup.${this.step.value}.title`)}
        </h2>

        {this.error && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 text-[12px] font-semibold">
            {this.error}
          </div>
        )}

        <form onSubmit={this.handleSubmit} className="space-y-6" noValidate>
          {this.currentStep}
          <div className="flex items-center gap-3">
            {!this.step.isFirst && (
              <Button type="button" variant={ButtonVariant.SECONDARY} onClick={this.handleBack} className="py-3">
                {this.text('setup.actions.back')}
              </Button>
            )}
            <Button type="submit" className="flex-1 py-4 text-base font-semibold rounded-xl" isLoading={this.isLoading}>
              {this.step.isLast ? this.text('setup.actions.finish') : this.text('setup.actions.continue')}
            </Button>
          </div>
        </form>
      </SetupFrame>
    );
  }
}
