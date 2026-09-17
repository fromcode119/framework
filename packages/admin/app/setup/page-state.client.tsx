import { AdminComponent } from '@/components/view/admin-component.client';
import { bound, state } from '@fromcode119/react-class-components';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';
import { SetupPhase } from '@fromcode119/core/client';
import type { ISetupDatabaseOptions } from '@/app/setup/interfaces/setup-database-options.interface';
import type { ISetupDatabaseServer } from '@/app/setup/interfaces/setup-database-server.interface';
import type { ISetupAccountErrors } from '@/app/setup/interfaces/setup-account-errors.interface';
import { SetupAccountValidation } from '@/app/setup/setup-account-validation';

/**
 * What the first-run wizard has been told so far, and the edits that only change a field.
 *
 * The base of the wizard's chain — the work it does, then the steps it draws, then the lifecycle.
 *
 * Nothing here is defaulted on the operator's behalf beyond what the browser itself reports (its
 * locale); every other value is blank until typed, so the wizard never creates a platform configured
 * with something nobody chose.
 */
export abstract class SetupPageState extends AdminComponent {
  /** How long to wait for the container manager to bring the api back after the database step. */
  protected static readonly RESTART_TIMEOUT_MS = 120_000;
  protected static readonly RESTART_POLL_MS = 2_000;

  protected mounted = false;

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
  /**
   * The server the operator is pointing this at, or null for the one this deployment ships.
   *
   * Null is not "empty values" — it is a different answer, and the difference decides whether the
   * platform provisions its own roles or uses roles that already exist somewhere else.
   */
  @state databaseServer: ISetupDatabaseServer | null = null;

  /** Their browser's language when the console speaks it, otherwise the dictionary every key is written in. */
  protected get browserLocale(): string {
    const preferred = String(navigator?.language || '').trim();
    return AdminDictionary.has(preferred) ? preferred.toLowerCase().split('-')[0] : AdminDictionary.FALLBACK_LOCALE;
  }

  protected text(key: string): string {
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
  @bound
  handleDatabaseDriverChange(value: string): void {
    this.databaseDriver = value;
    // A driver this deployment ships no server for has only one route, so the form opens with it
    // rather than offering a bundled option that does not exist.
    const driver = this.databaseOptions?.drivers.find((entry) => entry.value === value);
    if (driver && !driver.hasBundledServer) this.handleUseOwnServer(true);
    if (driver?.hasBundledServer) this.databaseServer = null;
  }

  @bound
  handleUseOwnServer(useOwn: boolean): void {
    if (!useOwn) {
      this.databaseServer = null;
      return;
    }
    const port = this.databaseOptions?.drivers.find((entry) => entry.value === this.databaseDriver)?.defaultPort;
    // Prefilled with the driver's own port and nothing else: every other field is a fact only the
    // operator has, and a plausible-looking default would be a guess about someone's infrastructure.
    this.databaseServer = {
      host: '', port: port ? String(port) : '', database: '',
      user: '', password: '', ownerUser: '', ownerPassword: '',
    };
  }

  @bound
  handleDatabaseServerChange(field: keyof ISetupDatabaseServer, value: string): void {
    if (!this.databaseServer) return;
    this.databaseServer = { ...this.databaseServer, [field]: value };
  }

  /** The first driver this build can actually install — never one that is listed but unavailable. */
  protected firstAvailableDriver(options: ISetupDatabaseOptions | null): string {
    return options?.drivers.find((driver) => driver.isAvailable)?.value ?? '';
  }

  protected get accountErrors(): ISetupAccountErrors {
    return SetupAccountValidation.check(this, {
      required: this.text('setup.errors.required'),
      mismatch: this.text('setup.errors.passwordMismatch'),
    });
  }
}
