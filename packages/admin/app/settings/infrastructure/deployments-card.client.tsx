import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { DeployMode, SystemConstants } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { AdminDeployClient } from '@/lib/settings/admin-deploy-client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * How a release replaces the running apps — and whether this box can do it without downtime.
 *
 * The mode is the platform setting `deploy_mode`, read by the deploy command on the box. The capacity
 * line is measured by the api the same way that command measures it, so this card never promises a
 * rolling deploy the command would then refuse; when the memory is not there it says so, and says the
 * deploy will restart instead. The one rule it cannot evaluate in advance — whether the next release
 * carries core migrations — is stated rather than guessed.
 */
export class DeploymentsCard extends AdminComponent {
  @state loading = true;
  @state saving = false;

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;
  @state mode = DeployMode.RESTART.value;
  @state capacity: { fits: boolean; summary: string } | null = null;
  @state loadError = '';

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ mode: this.mode }),
      () => this.save(),
      (values) => { this.mode = values.mode; },
    );
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const answer = await AdminDeployClient.capacity();
      this.mode = DeployMode.resolve(answer.mode).value;
      this.capacity = { fits: answer.fits, summary: answer.summary };
      this.pending?.mark();
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('settings.infrastructure.theDeployCapacityCouldNot');
    } finally {
      this.loading = false;
    }
  }

  @bound onMode(value: string): void {
    this.mode = DeployMode.resolve(value).value;
  }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update({ [SystemConstants.META_KEY.DEPLOY_MODE]: this.mode });
      this.runtime.notify.addNotification({ title: AdminI18n.t('settings.infrastructure.deployModeSaved'), message: AdminI18n.t('settings.infrastructure.theNextDeployUsesIt'), type: NotificationType.SUCCESS });
    } catch (err: any) {
      this.pending?.failed();
      this.runtime.notify.addNotification({ title: AdminI18n.t('settings.infrastructure.deployModeNotSaved'), message: err?.message || AdminI18n.t('settings.infrastructure.theSettingCouldNotBe'), type: NotificationType.ERROR });
    } finally {
      this.saving = false;
    }
  }

  private verdict(): ReactNode {
    if (this.loadError) return <p className="text-xs text-[var(--destructive)]">{this.loadError}</p>;
    if (!this.capacity) return null;
    const rolling = this.mode === DeployMode.ROLLING.value;
    const tone = this.capacity.fits ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
    const headline = this.capacity.fits
      ? AdminI18n.t('settings.infrastructure.rollingFits')
      : rolling ? AdminI18n.t('settings.infrastructure.rollingWillRestart') : AdminI18n.t('settings.infrastructure.rollingNoRoom');
    return (
      <div className="mt-3 space-y-1 text-xs">
        <p className={`font-medium ${tone}`}>{headline}</p>
        <p className="fc-tone-muted">{AdminI18n.t('settings.infrastructure.measuredNow', { summary: this.capacity.summary })}</p>
        <p className="fc-tone-muted">
          {AdminI18n.t('settings.infrastructure.eitherModeAReleaseWith')}
        </p>
      </div>
    );
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.infrastructure.deployments')}>
        <SettingRow
          theme={this.theme}
          title={AdminI18n.t('settings.infrastructure.howAReleaseReplacesThe')}
          stacked
          description={AdminI18n.t('settings.infrastructure.restartEveryAppIsRecreated')}
        >
          <div className="fc-settings-group">
            <div className="fc-settings-short">
              <Select
                theme={this.theme}
                value={this.mode}
                onChange={this.onMode}
                disabled={this.loading}
                options={[
                  { value: DeployMode.RESTART.value, label: AdminI18n.t('settings.infrastructure.restartAbout45SOf') },
                  { value: DeployMode.ROLLING.value, label: AdminI18n.t('settings.infrastructure.rollingNoDowntime') },
                ]}
              />
            </div>
          </div>
          {this.verdict()}
        </SettingRow>
      </Card>
    );
  }
}
