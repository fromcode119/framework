import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Switch } from '@/components/ui/view/switch.client';
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

  @state saving = false;

  private static readonly POLL_MS = 5000;
  private poll: ReturnType<typeof setTimeout> | null = null;

  componentDidMount(): void {
    this.follow();
  }

  componentDidUpdate(): void {
    this.follow();
  }

  componentWillUnmount(): void {
    if (this.poll) clearTimeout(this.poll);
  }

  /** An update was asked for or is running: re-check every few seconds until it ends. */
  private get active(): boolean {
    return Boolean(this.selfUpdate.requested) || this.selfUpdate.status?.state === 'updating';
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
  private async setAutomatic(on: boolean): Promise<void> {
    this.saving = true;
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { [SelfUpdatePanel.SETTING]: on ? 'true' : 'false' });
      this.onChanged();
    } catch (error: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.selfUpdate.saveFailed'), error?.message || '');
    } finally {
      this.saving = false;
    }
  }

  /** One sentence for where the updater is, from its own report. */
  private get statusLine(): { text: string; tone: string } {
    const { status, updaterRunning, plan } = this.selfUpdate;
    if (!updaterRunning) return { text: AdminI18n.t('settings.updates.selfUpdate.notRunning'), tone: 'text-rose-500' };
    if (status?.step === SelfUpdatePanel.OFF_STEP) return { text: AdminI18n.t('settings.updates.selfUpdate.turnedOff'), tone: 'text-amber-600' };
    if (status?.state === 'updating') return { text: AdminI18n.t('settings.updates.selfUpdate.updating', { to: status.to, step: status.step }), tone: 'text-indigo-500' };
    if (plan?.reason === 'heldFailed') return { text: AdminI18n.t('settings.updates.selfUpdate.heldFailed', { version: plan.heldBy, error: status?.error ?? '' }), tone: 'text-rose-500' };
    if (status?.state === 'failed') return { text: AdminI18n.t('settings.updates.selfUpdate.failed', { to: status.to, error: status.error }), tone: 'text-rose-500' };
    if (status?.state === 'rolledBack') return { text: AdminI18n.t('settings.updates.selfUpdate.rolledBack', { to: status.to, error: status.error }), tone: 'text-rose-500' };
    if (plan?.reason === 'unknown') return { text: AdminI18n.t('settings.updates.selfUpdate.unknown'), tone: 'text-amber-600' };
    if (plan?.reason === 'heldBreaking') return { text: AdminI18n.t('settings.updates.selfUpdate.heldBreaking', { version: plan.heldBy }), tone: 'text-amber-600' };
    if (status?.state === 'succeeded' && String(status.to).replace(/^v/, '') === String(plan?.current ?? '')) return { text: AdminI18n.t('settings.updates.selfUpdate.succeeded', { to: status.to }), tone: 'text-emerald-600' };
    return { text: AdminI18n.t('settings.updates.selfUpdate.ready'), tone: 'text-slate-500' };
  }

  render(): ReactNode {
    const line = this.statusLine;
    return (
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-800/40">
        <Switch
          checked={this.selfUpdate.plan?.automatic === true}
          onChange={this.setAutomatic}
          disabled={this.saving}
          label={AdminI18n.t('settings.updates.selfUpdate.automatic')}
          description={AdminI18n.t('settings.updates.selfUpdate.automaticExplained')}
        />
        <p className={`text-[11px] font-medium leading-relaxed ${line.tone}`}>{line.text}</p>
      </div>
    );
  }
}
