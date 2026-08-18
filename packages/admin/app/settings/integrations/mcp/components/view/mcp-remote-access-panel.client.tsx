import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Loader } from '@/components/ui/view/loader.client';
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

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    try {
      const settings = await AdminApi.get('/system/admin/settings');
      if (!this.mounted) return;
      this.enabled = String(settings?.mcp_remote_enabled ?? '') === 'true' || settings?.mcp_remote_enabled === true;
    } catch (error: any) {
      this.notifyError('Failed to load the remote access setting', error);
    } finally {
      if (this.mounted) this.loading = false;
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
      await AdminApi.post('/system/admin/settings', { mcp_remote_enabled: next });
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
          <Switch
            checked={this.enabled}
            disabled={this.saving}
            label="Hosted MCP endpoint"
            description={this.enabled ? 'Remote clients may connect to POST /api/v1/mcp with a token.' : 'Disabled — the endpoint answers 403 to everyone.'}
            onChange={(next: boolean) => { void this.setEnabled(next); }}
          />
        )}
      </Card>
    );
  }
}
