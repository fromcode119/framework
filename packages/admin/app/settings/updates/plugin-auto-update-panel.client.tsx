import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { NotificationType } from '@/components/enums/notification-type.enum';

/**
 * The switch for installing newer marketplace plugin versions automatically, and what the last
 * automatic check did.
 *
 * Both come straight from the stored settings: the switch is `plugins_auto_update`, the report is
 * `plugins_auto_update_status`, which only the api writes (the settings endpoint hands JSON values back parsed). The panel never claims an update happened
 * that the report does not say happened.
 */
export class PluginAutoUpdatePanel extends AdminComponent {
  @state loaded = false;
  @state saving = false;
  @state automatic = false;
  @state report: { checkedAt: string; updatedAt: string; updated: string[]; failed: { slug: string; error: string }[]; error: string } | null = null;

  private static readonly SETTING = 'plugins_auto_update';
  private static readonly REPORT = 'plugins_auto_update_status';

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const settings = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { noDedupe: true });
      this.automatic = String(settings?.[PluginAutoUpdatePanel.SETTING] ?? '') === 'true';
      this.report = settings?.[PluginAutoUpdatePanel.REPORT] ?? null;
      this.loaded = true;
    } catch (error: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.pluginAuto.loadFailed'), error?.message || '');
    }
  }

  @bound
  private async setAutomatic(on: boolean): Promise<void> {
    this.saving = true;
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { [PluginAutoUpdatePanel.SETTING]: on ? 'true' : 'false' });
      this.automatic = on;
    } catch (error: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.pluginAuto.saveFailed'), error?.message || '');
    } finally {
      this.saving = false;
    }
  }

  /** One sentence for what the last automatic check did, from its own report. */
  private get statusLine(): { text: string; tone: string } {
    const report = this.report;
    if (!this.automatic) return { text: AdminI18n.t('settings.updates.pluginAuto.off'), tone: 'text-amber-600' };
    if (!report?.checkedAt) return { text: AdminI18n.t('settings.updates.pluginAuto.notChecked'), tone: 'text-slate-500' };
    const at = new Date(report.checkedAt).toLocaleString();
    if (report.error) return { text: AdminI18n.t('settings.updates.pluginAuto.unreachable', { at, error: report.error }), tone: 'text-rose-500' };
    if (report.failed?.length) {
      const failed = report.failed.map((entry) => `${entry.slug} (${entry.error})`).join('; ');
      return { text: AdminI18n.t('settings.updates.pluginAuto.failed', { at, failed }), tone: 'text-rose-500' };
    }
    if (report.updated?.length) {
      const when = report.updatedAt ? new Date(report.updatedAt).toLocaleString() : at;
      return { text: AdminI18n.t('settings.updates.pluginAuto.updated', { at, when, plugins: report.updated.join(', ') }), tone: 'text-emerald-600' };
    }
    return { text: AdminI18n.t('settings.updates.pluginAuto.current', { at }), tone: 'text-slate-500' };
  }

  render(): ReactNode {
    if (!this.loaded) return null;
    const line = this.statusLine;
    return (
      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-800/40">
        <Switch
          checked={this.automatic}
          onChange={this.setAutomatic}
          disabled={this.saving}
          label={AdminI18n.t('settings.updates.pluginAuto.automatic')}
          description={AdminI18n.t('settings.updates.pluginAuto.automaticExplained')}
        />
        <p className={`text-[11px] font-medium leading-relaxed ${line.tone}`}>{line.text}</p>
      </div>
    );
  }
}
