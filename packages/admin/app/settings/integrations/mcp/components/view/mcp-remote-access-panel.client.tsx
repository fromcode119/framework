import { Hint } from '@/components/ui/view/hint.client';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { ApiPathUtils, SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The hosted MCP transport toggle — the operator-visible switch behind `mcp_remote_enabled`.
 *
 * OFF by default: remote MCP clients (Claude web/desktop) can reach `POST /api/mcp` only while
 * this is on, and every request still needs an API token from the panel below. The setting is a
 * declared system setting (`_system_meta`), written through the same endpoint as the rest of
 * Settings, and the api reads it live — no restart involved. Both values are written by the page's
 * one save bar, like every other setting.
 */
export class McpRemoteAccessPanel extends AdminComponent {
  @state loading = true;
  @state enabled = false;
  @state maxMediaMb: number | string = '';
  /**
   * Both keys are per-site. In the platform scope the API refuses each write, so the toggle answered
   * 400 on every click while looking like a working switch.
   */
  @state scope: SettingsPageScope | null = null;

  private mounted = false;
  /** What the page's one save bar reads and writes for this panel; made once it is mounted. */
  private pending: PendingSave | null = null;

  private get outOfScope(): boolean {
    return this.scope?.isEmpty === true;
  }

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(
      () => ({ enabled: this.enabled, maxMediaMb: this.maxMediaMb }),
      () => this.save(),
      (values) => { this.enabled = values.enabled; this.maxMediaMb = values.maxMediaMb; },
    );
    try {
      const settings = await AdminApi.get(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS);
      if (!this.mounted) return;
      this.enabled = String(settings?.[SystemConstants.META_KEY.MCP_REMOTE_ENABLED] ?? '') === 'true' || settings?.[SystemConstants.META_KEY.MCP_REMOTE_ENABLED] === true;
      this.maxMediaMb = Number(settings?.[SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB] || 0) || '';
      this.pending.mark();
    } catch (error: any) {
      this.notifyError(AdminI18n.t('settings.integrations.failedToLoadTheRemote'), error);
    } finally {
      if (this.mounted) this.loading = false;
    }
    const scope = new SettingsPageScope(
      await PlatformSettingLocks.load(),
      [SystemConstants.META_KEY.MCP_REMOTE_ENABLED, SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB],
    );
    if (this.mounted) this.scope = scope;
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  /** Writes both values at once. A limit left blank is not written; a limit that is not above zero is refused. */
  private async save(): Promise<void> {
    const payload: Record<string, unknown> = { [SystemConstants.META_KEY.MCP_REMOTE_ENABLED]: this.enabled };
    if (this.maxMediaMb !== '') {
      const limit = Number(this.maxMediaMb);
      if (!Number.isFinite(limit) || limit <= 0) {
        this.pending?.failed();
        this.runtime.notify.addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.integrations.invalidMediaLimit'),
          message: AdminI18n.t('settings.integrations.enterAValueGreaterThan'),
        });
        return;
      }
      payload[SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB] = limit;
    }
    try {
      await AdminApi.post(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS, payload);
    } catch (error: any) {
      this.pending?.failed();
      this.notifyError(AdminI18n.t('settings.integrations.failedToSaveTheMcp'), error);
    }
  }

  @bound private onEnabled(next: boolean): void { this.enabled = next; }
  @bound private onLimit(value: number | string): void { this.maxMediaMb = value; }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({
      type: NotificationType.ERROR,
      title,
      message: error?.message || AdminI18n.t('settings.integrations.unexpectedError'),
    });
  }

  private renderBody(): ReactNode {
    if (this.loading) return <div className="fc-settings-note"><Loader /></div>;
    if (this.outOfScope) {
      return <div className="fc-settings-note"><Hint>{AdminI18n.t('settings.integrations.remoteAccessIsConfiguredPer')}</Hint></div>;
    }
    return (
      <>
        <SettingRow
          theme={this.theme}
          title={AdminI18n.t('settings.integrations.hostedMcpEndpoint')}
          description={this.enabled ? AdminI18n.t('settings.integrations.remoteClientsMayConnectTo', { path: ApiPathUtils.versioned('/mcp') }) : AdminI18n.t('settings.integrations.disabledTheEndpointAnswers403')}
          width={SettingRowWidth.AUTO}
        >
          <Switch checked={this.enabled} onChange={this.onEnabled} />
        </SettingRow>
        <SettingRow theme={this.theme} title={AdminI18n.t('settings.integrations.mediaPayloadLimitMb')} description={AdminI18n.t('settings.integrations.maximumDecodedUploadOrRemote')} width={SettingRowWidth.NARROW}>
          <NumberStepper min={1} value={this.maxMediaMb} onChange={this.onLimit} />
        </SettingRow>
      </>
    );
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.integrations.remoteAccess')} description={AdminI18n.t('settings.integrations.letRemoteMcpClientsClaude')}>
        {this.renderBody()}
      </Card>
    );
  }
}
