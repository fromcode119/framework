import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';

/**
 * The hosted MCP transport toggle — the operator-visible switch behind `mcp_remote_enabled`.
 *
 * OFF by default: remote MCP clients (Claude web/desktop) can reach `POST /api/v1/mcp` only while
 * this is on, and every request still needs an API token from the panel below. The setting is a
 * declared system setting (`_system_meta`), written through the same endpoint as the rest of
 * Settings, and the api reads it live — no restart involved.
 */
export class McpRemoteAccessPanel extends AdminComponent {
  @state loading = true;
  @state saving = false;
  @state enabled = false;
  @state maxMediaMb: number | string = '';

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const settings = await AdminApi.get(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS);
      if (!this.mounted) return;
      this.enabled = String(settings?.[SystemConstants.META_KEY.MCP_REMOTE_ENABLED] ?? '') === 'true' || settings?.[SystemConstants.META_KEY.MCP_REMOTE_ENABLED] === true;
      this.maxMediaMb = Number(settings?.[SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB] || 0) || '';
    } catch (error: any) {
      this.notifyError('Failed to load the remote access setting', error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async saveMediaLimit(): Promise<void> {
    const limit = Number(this.maxMediaMb);
    if (!Number.isFinite(limit) || limit <= 0) {
      this.runtime.notify.addNotification({
        type: NotificationType.ERROR,
        title: 'Invalid media limit',
        message: 'Enter a value greater than zero megabytes.',
      });
      return;
    }
    this.saving = true;
    try {
      await AdminApi.post(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS, { [SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB]: limit });
    } catch (error: any) {
      this.notifyError('Failed to save the MCP media limit', error);
    } finally {
      if (this.mounted) this.saving = false;
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async setEnabled(next: boolean): Promise<void> {
    this.saving = true;
    const previous = this.enabled;
    this.enabled = next;
    try {
      await AdminApi.post(SystemConstants.API_PATH.SYSTEM.ADMIN_SETTINGS, { [SystemConstants.META_KEY.MCP_REMOTE_ENABLED]: next });
    } catch (error: any) {
      this.enabled = previous;
      this.notifyError('Failed to save the remote access setting', error);
    } finally {
      if (this.mounted) this.saving = false;
    }
  }

  private notifyError(title: string, error: any): void {
    this.runtime.notify.addNotification({
      type: NotificationType.ERROR,
      title,
      message: error?.message || 'Unexpected error.',
    });
  }

  render(): ReactNode {
    return (
      <Card title="Remote access">
        <p className="mb-3 text-xs text-slate-500">
          Let remote MCP clients (Claude web or desktop) connect over Streamable HTTP. Every request still requires an access token from below.
        </p>
        {this.loading ? (
          <Loader />
        ) : (
          <div className="space-y-5">
            <Switch
              checked={this.enabled}
              disabled={this.saving}
              label="Hosted MCP endpoint"
              description={this.enabled ? 'Remote clients may connect to POST /api/v1/mcp with a token.' : 'Disabled — the endpoint answers 403 to everyone.'}
              onChange={(next: boolean) => { void this.setEnabled(next); }}
            />
            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-900 dark:text-white">Media payload limit (MB)</label>
              <p className="text-xs text-slate-500">Maximum decoded upload or remote download accepted by MCP media tools.</p>
              <div className="flex items-start gap-2">
                <div className="w-36">
                  <NumberStepper min={1} value={this.maxMediaMb} onChange={(value) => { this.maxMediaMb = value; }} />
                </div>
                <Button variant={ButtonVariant.SECONDARY} size={FieldSize.MD} isLoading={this.saving} onClick={() => this.saveMediaLimit()}>Save limit</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }
}
