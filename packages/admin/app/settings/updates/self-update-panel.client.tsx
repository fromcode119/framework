import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { UpdateNoteTone } from '@/app/settings/updates/update-note-tone';
import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Switch } from '@/components/ui/view/switch.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';

/**
 * How an installation that runs published images updates itself: the automatic switch, and what the
 * updater service last said.
 *
 * Everything shown comes from the api's `selfUpdate` answer — the setting, the updater's own report,
 * whether it has reported recently — so the screen never claims an update is happening that nothing
 * is doing. An absent updater is said plainly, because then neither the switch nor the button can act.
 */
export class SelfUpdatePanel extends AdminComponent {
  @prop declare selfUpdate: { plan: any; requested: string; status: any; updaterRunning: boolean };
  @prop declare onChanged: () => void;
  /** A fresh update check taken while following an update, handed to the page without a spinner. */
  @prop declare onPolled: (check: any) => void;

  @state automatic = false;
  @state confirmRestart = false;
  @state restarting = false;

  private static readonly POLL_MS = 5000;
  private poll: ReturnType<typeof setTimeout> | null = null;

  /** What the page's one save bar reads and writes for this panel. */
  private pending: PendingSave | null = null;

  componentDidMount(): void {
    this.automatic = this.selfUpdate.plan?.automatic === true;
    this.pending = new PendingSave(() => this.automatic, () => this.save(), (value) => { this.automatic = value; });
    this.pending.mark();
    this.follow();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
    this.follow();
  }

  componentWillUnmount(): void {
    if (this.poll) clearTimeout(this.poll);
    this.pending?.dispose();
  }

  /** An update was asked for or is running: re-check every few seconds until it ends. A held one waits. */
  private get active(): boolean {
    if (this.held) return false;
    return Boolean(this.selfUpdate.requested) || this.selfUpdate.status?.state === 'updating';
  }

  /** The mode is rolling, rolling was not possible for this version, and nothing was changed. */
  private get held(): boolean {
    return this.selfUpdate.plan?.reason === 'heldRolling';
  }

  /** "Update with restart": the operator accepts the short interruption rolling would have avoided. */
  @bound
  private async updateWithRestart(): Promise<void> {
    this.restarting = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_APPLY, { restart: true });
      this.confirmRestart = false;
      this.onChanged();
    } catch (error: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.selfUpdate.saveFailed'), error?.message || '');
    } finally {
      this.restarting = false;
    }
  }

  /**
   * Quiet on purpose: in the middle of an update the api restarts, and a refused check then is
   * expected, not an error to pop up. When the update ends the page reloads, because the admin it is
   * running in may itself have been replaced.
   */
  private follow(): void {
    if (this.poll || !this.active) return;
    this.poll = setTimeout(async () => {
      this.poll = null;
      const check = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK, { noDedupe: true }).catch(() => null);
      if (!check?.selfUpdate) return this.follow();
      const finished = !check.selfUpdate.requested && check.selfUpdate.status?.state !== 'updating';
      if (finished) {
        window.location.reload();
        return;
      }
      this.onPolled(check);
    }, SelfUpdatePanel.POLL_MS);
  }

  private static readonly SETTING = 'framework_auto_update';
  private static readonly OFF_STEP = 'turnedOffByDeployment';

  @bound
  private setAutomatic(on: boolean): void {
    this.automatic = on;
  }

  /** Written by the page's save bar; the page then reads the updater's answer again. */
  private async save(): Promise<void> {
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { [SelfUpdatePanel.SETTING]: this.automatic ? 'true' : 'false' });
      this.onChanged();
    } catch (error: any) {
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.selfUpdate.saveFailed'), error?.message || '');
    }
  }

  /** One sentence for where the updater is, from its own report. */
  private get statusLine(): { text: string; tone: string } {
    const { status, updaterRunning, plan } = this.selfUpdate;
    if (!updaterRunning) return { text: AdminI18n.t('settings.updates.selfUpdate.notRunning'), tone: 'danger' };
    if (status?.step === SelfUpdatePanel.OFF_STEP) return { text: AdminI18n.t('settings.updates.selfUpdate.turnedOff'), tone: 'warning' };
    if (status?.state === 'updating') return { text: AdminI18n.t('settings.updates.selfUpdate.updating', { to: status.to, step: status.step }), tone: 'info' };
    if (this.held) return { text: AdminI18n.t('settings.updates.selfUpdate.heldRolling', { version: plan.heldBy, reason: status?.deployReason ?? '' }), tone: 'warning' };
    if (plan?.reason === 'heldFailed') return { text: AdminI18n.t('settings.updates.selfUpdate.heldFailed', { version: plan.heldBy, error: status?.error ?? '' }), tone: 'danger' };
    if (status?.state === 'failed') return { text: AdminI18n.t('settings.updates.selfUpdate.failed', { to: status.to, error: status.error }), tone: 'danger' };
    if (status?.state === 'rolledBack') return { text: AdminI18n.t('settings.updates.selfUpdate.rolledBack', { to: status.to, error: status.error }), tone: 'danger' };
    if (plan?.reason === 'unknown') return { text: AdminI18n.t('settings.updates.selfUpdate.unknown'), tone: 'warning' };
    if (plan?.reason === 'heldBreaking') return { text: AdminI18n.t('settings.updates.selfUpdate.heldBreaking', { version: plan.heldBy }), tone: 'warning' };
    if (status?.state === 'succeeded' && String(status.to).replace(/^v/, '') === String(plan?.current ?? '')) return { text: AdminI18n.t('settings.updates.selfUpdate.succeeded', { to: status.to }), tone: 'success' };
    return { text: AdminI18n.t('settings.updates.selfUpdate.ready'), tone: '' };
  }

  /** How the last update replaced the apps and why — a restart takes every site down while it runs. */
  private get deployLine(): string {
    const status = this.selfUpdate.status;
    if (!status?.deployMode) return '';
    return AdminI18n.t('settings.updates.selfUpdate.deployMode', { mode: status.deployMode, reason: status.deployReason ?? '' });
  }

  render(): ReactNode {
    const line = this.statusLine;
    return (
      <Card>
        <SettingRow theme={this.theme} title={AdminI18n.t('settings.updates.selfUpdate.automatic')} description={AdminI18n.t('settings.updates.selfUpdate.automaticExplained')} width={SettingRowWidth.AUTO}>
          <Switch checked={this.automatic} onChange={this.setAutomatic} />
        </SettingRow>
        <div className="fc-settings-note fc-settings-note--of-row"><Hint variant={UpdateNoteTone.of(line.tone)}>{line.text}</Hint></div>
        {this.deployLine && !this.held ? <div className="fc-settings-note fc-settings-note--of-row"><Hint>{this.deployLine}</Hint></div> : null}
        {this.held ? (
          <div className="fc-settings-note fc-settings-note--of-row">
            <Button variant={ButtonVariant.PRIMARY} isLoading={this.restarting} onClick={() => { this.confirmRestart = true; }}>
              {AdminI18n.t('settings.updates.selfUpdate.updateWithRestart', { version: this.selfUpdate.plan?.heldBy })}
            </Button>
          </div>
        ) : null}
        <ConfirmDialog
          isOpen={this.confirmRestart}
          onClose={() => { this.confirmRestart = false; }}
          onConfirm={this.updateWithRestart}
          isLoading={this.restarting}
          title={AdminI18n.t('settings.updates.selfUpdate.updateWithRestart', { version: this.selfUpdate.plan?.heldBy })}
          description={AdminI18n.t('settings.updates.selfUpdate.updateWithRestartExplained')}
        />
      </Card>
    );
  }
}
