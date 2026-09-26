import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { DeployMode, SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SettingRow } from '@/app/settings/general/setting-row';
import { AdminDeployClient } from '@/lib/settings/admin-deploy-client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';

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
  @state mode = DeployMode.RESTART.value;
  @state capacity: { fits: boolean; summary: string } | null = null;
  @state loadError = '';

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const answer = await AdminDeployClient.capacity();
      this.mode = DeployMode.resolve(answer.mode).value;
      this.capacity = { fits: answer.fits, summary: answer.summary };
    } catch (err: any) {
      this.loadError = err?.message || 'The deploy capacity could not be read.';
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
      this.runtime.notify.addNotification({ title: 'Deploy mode saved', message: 'The next deploy uses it.', type: NotificationType.SUCCESS });
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Deploy mode not saved', message: err?.message || 'The setting could not be saved.', type: NotificationType.ERROR });
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
      ? 'This server has room for a rolling deploy.'
      : rolling ? 'Not enough memory for a rolling deploy right now — deploys will restart instead.' : 'Not enough memory for a rolling deploy right now.';
    return (
      <div className="mt-3 space-y-1 text-xs">
        <p className={`font-semibold ${tone}`}>{headline}</p>
        <p className="text-slate-500">Measured now: {this.capacity.summary}.</p>
        <p className="text-slate-500">
          Either mode: a release with new database migrations always restarts (the old version cannot keep serving
          a changed schema), and the gateway itself restarts for a second or two.
        </p>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <Card title="Deployments">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Refresh}
          title="How a release replaces the running apps"
          stacked
          description="Restart: every app is recreated at once, and every site is down for about 45 seconds. Rolling: one app at a time, the new copy serving before the old one stops — no downtime, but it needs spare memory for a second copy of the largest app while it is swapped. Plugin processes run in the extension-host and carry over either way; a rolling deploy leaves the extension-host itself on its version, and it moves to a new one on the next restart deploy."
        >
          <div className="flex items-center gap-3">
            <div className="w-full md:w-72">
              <Select
                theme={this.theme}
                value={this.mode}
                onChange={this.onMode}
                disabled={this.loading}
                options={[
                  { value: DeployMode.RESTART.value, label: 'Restart — about 45 s of downtime' },
                  { value: DeployMode.ROLLING.value, label: 'Rolling — no downtime' },
                ]}
              />
            </div>
            <Button onClick={this.save} isLoading={this.saving} disabled={this.loading} icon={<FrameworkIcons.Save size={13} />}>Save</Button>
          </div>
          {this.verdict()}
        </SettingRow>
      </Card>
    );
  }
}
