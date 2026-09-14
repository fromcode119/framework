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
import { SetupDomainStep } from '@/app/setup/setup-domain-step.client';
import { SetupDatabaseStep } from '@/app/setup/setup-database-step.client';
import { SetupPhase } from '@fromcode119/core/client';
import type { ISetupDatabaseOptions } from '@/app/setup/setup-database-options.interface';
import type { ISetupAccountErrors } from '@/app/setup/setup-account-errors.interface';
import { SetupAccountValidation } from '@/app/setup/setup-account-validation';

/**
 * The first screen a new installation ever shows: language, administrator account, platform.
 *
 * Language comes first because every word after it depends on the answer. Each value maps to a
 * setting Settings already owns and displays, and anything left blank is not written at all.
 */
export class SetupPage extends AdminComponent {
  /** How long to wait for the container manager to bring the api back after the database step. */
  private static readonly RESTART_TIMEOUT_MS = 120_000;
  private static readonly RESTART_POLL_MS = 2_000;

  private mounted = false;

  @state isLoading = false;
  @state isChecking = true;
  @state step: SetupStep = SetupStep.LANGUAGE;
  @state locale = AdminDictionary.FALLBACK_LOCALE;
  @state email = '';
  @state password = '';
  @state confirmPassword = '';
  @state platformName = '';
  /**
   * The domain this admin will answer on — prefilled with the origin you are standing on.
   *
   * Derived from the request, not invented: it is the origin the operator just used. Empty on the
   * server, where there is no origin to read, and filled in once mounted.
   */
  @state adminUrl = '';
  @state timezone = '';
  @state error = '';
  @state fieldErrors: ISetupAccountErrors = {};
  /**
   * Which question this installation is still waiting on — see `SetupPhase`.
   *
   * Defaults to the platform phase, so a deployment that was handed a `DATABASE_URL` — every
   * deployment that exists today — never sees the database step at all.
   */
  @state phase: SetupPhase = SetupPhase.PLATFORM;
  @state databaseOptions: ISetupDatabaseOptions | null = null;
  @state databaseDriver = '';

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.locale = this.browserLocale;
    this.timezone = TimezoneUtils.resolveSystemTimezone();
    // The origin the operator actually reached this page on. Derived, never invented — and shown
    // for confirmation on the last step rather than written silently.
    this.adminUrl = window.location.origin;
    try {
      // Asked FIRST, and answerable by a process with no database: it is the only call that can
      // tell an installation waiting to be pointed at a database from one waiting for an account.
      const setup = await AdminApi.get(AdminConstants.ENDPOINTS.SETUP.STATUS);
      if (String(setup?.phase || '') === SetupPhase.DATABASE.value) {
        this.phase = SetupPhase.DATABASE;
        this.databaseOptions = setup.options;
        this.databaseDriver = this.firstAvailableDriver(setup.options);
        if (setup.isClaimedByOther === true) this.error = this.text('setup.database.claimedByOther');
        return;
      }

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
  @bound handleAdminUrlChange(value: string): void { this.adminUrl = value; }
  @bound handleTimezoneChange(value: string): void { this.timezone = value; }
  @bound handleDatabaseDriverChange(value: string): void { this.databaseDriver = value; }

  /** The first driver this build can actually install — never one that is listed but unavailable. */
  private firstAvailableDriver(options: ISetupDatabaseOptions | null): string {
    return options?.drivers.find((driver) => driver.isAvailable)?.value ?? '';
  }

  /**
   * Commit the database, then wait for the deployment to come back.
   *
   * The api writes the connection and exits so its container restarts into a process that can use
   * it, which means the request AFTER this one has nothing to talk to for roughly twenty seconds.
   * That gap is expected, so failures while polling are not errors — only running out of patience is.
   */
  private async configureDatabase(): Promise<void> {
    this.isLoading = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SETUP.DATABASE, { driver: this.databaseDriver });
      await this.waitForRestart();
      this.phase = SetupPhase.PLATFORM;
      this.step = SetupStep.LANGUAGE;
    } catch (err: any) {
      this.error = err.message || this.text('setup.database.failed');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Poll until the api answers as a configured deployment again.
   *
   * Every failure here is the restart in progress — connection refused, a gateway 502 — so they are
   * swallowed deliberately. Giving up says so plainly rather than leaving a spinner forever: the
   * database was written either way, and the operator's next move is to reload, not to start over.
   */
  private async waitForRestart(): Promise<void> {
    const deadline = Date.now() + SetupPage.RESTART_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, SetupPage.RESTART_POLL_MS));
      if (!this.mounted) return;
      try {
        const setup = await AdminApi.get(AdminConstants.ENDPOINTS.SETUP.STATUS);
        if (String(setup?.phase || '') !== SetupPhase.DATABASE.value) return;
      } catch {
        // The deployment is restarting. Nothing is listening yet; that is what we are waiting for.
      }
    }
    throw new Error(this.text('setup.database.restartTimeout'));
  }

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

    // The database phase is not a step in the stepper: it submits by itself, because answering it
    // restarts the deployment before the remaining questions can even be stored.
    if (this.phase === SetupPhase.DATABASE) {
      await this.configureDatabase();
      return;
    }

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
        adminUrl: this.adminUrl.trim(),
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
    if (this.phase === SetupPhase.DATABASE && this.databaseOptions) {
      return (
        <SetupDatabaseStep
          locale={this.locale}
          options={this.databaseOptions}
          driver={this.databaseDriver}
          onDriverChange={this.handleDatabaseDriverChange}
        />
      );
    }
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
    if (this.step === SetupStep.PLATFORM) {
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
    return (
      <SetupDomainStep
        locale={this.locale}
        adminUrl={this.adminUrl}
        onAdminUrlChange={this.handleAdminUrlChange}
      />
    );
  }

  /**
   * What the button says, and it has to say three different things.
   *
   * During the restart it says so explicitly: the spinner alone would look like a slow request,
   * when what is actually happening is that the deployment is being restarted underneath the page.
   */
  private get submitLabel(): string {
    if (this.phase === SetupPhase.DATABASE) {
      return this.text(this.isLoading ? 'setup.database.restarting' : 'setup.database.confirm');
    }
    return this.step.isLast ? this.text('setup.actions.finish') : this.text('setup.actions.continue');
  }

  render(): ReactElement {
    if (this.isChecking) return <SetupChecking locale={this.locale} />;

    return (
      <SetupFrame locale={this.locale}>
        {/* No stepper during the database phase: it is not one of the four steps, and showing
            "1 of 4" for a question that restarts the deployment would misstate where you are. */}
        {this.phase !== SetupPhase.DATABASE && <SetupStepper locale={this.locale} current={this.step} />}
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {this.text(this.phase === SetupPhase.DATABASE ? 'setup.database.title' : `setup.${this.step.value}.title`)}
        </h2>

        {this.error && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600 text-[12px] font-semibold">
            {this.error}
          </div>
        )}

        <form onSubmit={this.handleSubmit} className="space-y-6" noValidate>
          {this.currentStep}
          <div className="flex items-center gap-3">
            {this.phase !== SetupPhase.DATABASE && !this.step.isFirst && (
              <Button type="button" variant={ButtonVariant.SECONDARY} onClick={this.handleBack} className="py-3">
                {this.text('setup.actions.back')}
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 py-4 text-base font-semibold rounded-xl"
              isLoading={this.isLoading}
              disabled={this.phase === SetupPhase.DATABASE && !this.databaseDriver}
            >
              {this.submitLabel}
            </Button>
          </div>
        </form>
      </SetupFrame>
    );
  }
}
