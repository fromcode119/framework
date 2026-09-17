import type { ReactElement } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { TimezoneUtils } from '@/lib/timezone';
import { SetupChecking } from '@/app/setup/setup-checking.client';
import { SetupFrame } from '@/app/setup/setup-frame.client';
import { SetupStepper } from '@/app/setup/setup-stepper.client';
import { SetupPhase } from '@fromcode119/core/client';
import { SetupPageSteps } from '@/app/setup/page-steps.client';

/**
 * First run — the wizard that turns a fresh deployment into a platform.
 *
 * The top of the chain: the lifecycle and the frame around whichever step is current. What it knows,
 * what it does and what each step looks like live in the links below — see `SetupPageState`.
 */
export class SetupPage extends SetupPageSteps {
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
