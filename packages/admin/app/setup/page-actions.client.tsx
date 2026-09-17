import type { FormEvent } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { bound } from '@fromcode119/react-class-components';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';
import { SetupPhase } from '@fromcode119/core/client';
import { SetupPageState } from '@/app/setup/page-state.client';

/**
 * What the wizard actually does: probe the platform, commit the database choice, and create the
 * first administrator.
 *
 * Choosing a database RESTARTS the platform, so the wizard polls until it answers again rather than
 * assuming it came back — and gives up with a stated reason instead of waiting forever.
 */
export abstract class SetupPageActions extends SetupPageState {
  protected async initialize(): Promise<void> {
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

  /**
   * Commit the database, then wait for the deployment to come back.
   *
   * The api writes the connection and exits so its container restarts into a process that can use
   * it, which means the request AFTER this one has nothing to talk to for roughly twenty seconds.
   * That gap is expected, so failures while polling are not errors — only running out of patience is.
   */
  protected async configureDatabase(): Promise<void> {
    this.isLoading = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SETUP.DATABASE, {
        driver: this.databaseDriver,
        // Omitted entirely for the bundled database — the api reads its presence as the answer.
        ...(this.databaseServer ? { server: this.databaseServer } : {}),
      });
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
  protected async waitForRestart(): Promise<void> {
    const deadline = Date.now() + SetupPageState.RESTART_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, SetupPageState.RESTART_POLL_MS));
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
}
