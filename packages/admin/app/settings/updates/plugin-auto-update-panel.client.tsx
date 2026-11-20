import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { UpdateNoteTone } from '@/app/settings/updates/update-note-tone';
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
 * that the report does not say happened. The switch is written by the page's one save bar.
 */
export class PluginAutoUpdatePanel extends AdminComponent {
  @state loaded = false;
  @state automatic = false;
  @state report: { checkedAt: string; updatedAt: string; updated: string[]; failed: { slug: string; error: string }[]; error: string } | null = null;

  private static readonly SETTING = 'plugins_auto_update';
  private static readonly REPORT = 'plugins_auto_update_status';

  /** What the page's one save bar reads and writes for this panel. */
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(() => this.automatic, () => this.save(), (value) => { this.automatic = value; });
    await this.load();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  private async load(): Promise<void> {
    try {
      const settings = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { noDedupe: true });
      this.automatic = String(settings?.[PluginAutoUpdatePanel.SETTING] ?? '') === 'true';
      this.report = settings?.[PluginAutoUpdatePanel.REPORT] ?? null;
      this.loaded = true;
      this.pending?.mark();
    } catch (error: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.pluginAuto.loadFailed'), error?.message || '');
    }
  }

  @bound
  private setAutomatic(on: boolean): void {
    this.automatic = on;
  }

  private async save(): Promise<void> {
    try {
      await AdminApi.put(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS, { [PluginAutoUpdatePanel.SETTING]: this.automatic ? 'true' : 'false' });
    } catch (error: any) {
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.pluginAuto.saveFailed'), error?.message || '');
    }
  }

  /** One sentence for what the last automatic check did, from its own report. */
  private get statusLine(): { text: string; tone: string } {
    const report = this.report;
    if (!this.automatic) return { text: AdminI18n.t('settings.updates.pluginAuto.off'), tone: 'warning' };
    if (!report?.checkedAt) return { text: AdminI18n.t('settings.updates.pluginAuto.notChecked'), tone: '' };
    const at = new Date(report.checkedAt).toLocaleString();
    if (report.error) return { text: AdminI18n.t('settings.updates.pluginAuto.unreachable', { at, error: report.error }), tone: 'danger' };
    if (report.failed?.length) {
      const failed = report.failed.map((entry) => `${entry.slug} (${entry.error})`).join('; ');
      return { text: AdminI18n.t('settings.updates.pluginAuto.failed', { at, failed }), tone: 'danger' };
    }
    if (report.updated?.length) {
      const when = report.updatedAt ? new Date(report.updatedAt).toLocaleString() : at;
      return { text: AdminI18n.t('settings.updates.pluginAuto.updated', { at, when, plugins: report.updated.join(', ') }), tone: 'success' };
    }
    return { text: AdminI18n.t('settings.updates.pluginAuto.current', { at }), tone: '' };
  }

  render(): ReactNode {
    if (!this.loaded) return null;
    const line = this.statusLine;
    return (
      <Card>
        <SettingRow theme={this.theme} title={AdminI18n.t('settings.updates.pluginAuto.automatic')} description={AdminI18n.t('settings.updates.pluginAuto.automaticExplained')} width={SettingRowWidth.AUTO}>
          <Switch checked={this.automatic} onChange={this.setAutomatic} />
        </SettingRow>
        <div className="fc-settings-note fc-settings-note--of-row"><Hint variant={UpdateNoteTone.of(line.tone)}>{line.text}</Hint></div>
      </Card>
    );
  }
}
