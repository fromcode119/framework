import type { ReactElement } from 'react';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';
import { SetupLanguageStep } from '@/app/setup/setup-language-step.client';
import { SetupAccountStep } from '@/app/setup/setup-account-step.client';
import { SetupPlatformStep } from '@/app/setup/setup-platform-step.client';
import { SetupDomainStep } from '@/app/setup/setup-domain-step.client';
import { SetupDatabaseStep } from '@/app/setup/setup-database-step.client';
import { SetupPhase } from '@fromcode119/core/client';
import { SetupPageActions } from '@/app/setup/page-actions.client';

/**
 * The wizard's steps, and what its button says at each one.
 */
export abstract class SetupPageSteps extends SetupPageActions {
  protected get currentStep(): ReactElement {
    if (this.phase === SetupPhase.DATABASE && this.databaseOptions) {
      return (
        <SetupDatabaseStep
          locale={this.locale}
          options={this.databaseOptions}
          driver={this.databaseDriver}
          onDriverChange={this.handleDatabaseDriverChange}
          server={this.databaseServer}
          onServerChange={this.handleDatabaseServerChange}
          onUseOwnServer={this.handleUseOwnServer}
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
  protected get submitLabel(): string {
    if (this.phase === SetupPhase.DATABASE) {
      return this.text(this.isLoading ? 'setup.database.restarting' : 'setup.database.confirm');
    }
    return this.step.isLast ? this.text('setup.actions.finish') : this.text('setup.actions.continue');
  }
}
