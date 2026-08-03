import type { IAccountSessionsPanelState } from '@react/account/interfaces/account-sessions-panel-state.interface';
import type { ReactNode } from 'react';
import { Platform, state } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountSessionDeviceService } from '@react/account/session-device-service';
import { AccountClass } from '@react/account/account-class';

/** Plugin-owned default Sessions section for the framework AccountShell. Lists the signed-in user's
 * active sessions with device/browser, IP and start time, marks the current one, and lets them sign
 * out a single session or all the others. Registered into `account.panels`. */
export class AccountSessionsPanel extends PluginComponent {
  @state loading: boolean = true;
  @state revoking: boolean = false;
  @state revokingId: string = '';
  @state error: string = '';
  @state sessions: any[] = [];
  static readonly accountSection = { key: 'sessions', labelKey: 'account.section.sessions', priority: 65, descriptionKey: 'account.description.sessions' };

  private mounted = false;
  
  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      const data = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.SESSIONS_ME, { silent: true });
      const rows = data?.docs ?? data?.data ?? data?.sessions ?? (Array.isArray(data) ? data : []);
      if (this.mounted) this.setState({ sessions: Array.isArray(rows) ? rows : [], loading: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), loading: false });
    }
  }

  private async revokeOthers(): Promise<void> {
    this.setState({ revoking: true });
    try {
      await AccountAuthClient.of(this.api).post(RouteConstants.SEGMENTS.SESSIONS_REVOKE_OTHERS, {});
      await this.load();
      if (this.mounted) this.setState({ revoking: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ revoking: false, error: String(error?.message || error) });
    }
  }

  private async revokeOne(id: string): Promise<void> {
    if (!id) return;
    this.setState({ revokingId: id, error: '' });
    try {
      const path = String(RouteConstants.SEGMENTS.SESSIONS_ID_REVOKE).replace(':id', encodeURIComponent(id));
      const res = await AccountAuthClient.of(this.api).post(path, {});
      // Revoking the current session signs this device out — send the user back to a clean state.
      if (res?.revokedCurrent && Platform.isBrowser) { window.location.href = '/'; return; }
      await this.load();
      if (this.mounted) this.setState({ revokingId: '' });
    } catch (error: any) {
      if (this.mounted) this.setState({ revokingId: '', error: String(error?.message || error) });
    }
  }

  private formatDate(value: any): string {
    const d = value ? new Date(String(value)) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString(this.locale || 'bg-BG') : '';
  }

  private renderRow(s: any, i: number): ReactNode {
    // The sessions API may return camelCase (mapped) or raw snake_case rows — read both so the device,
    // IP and time always render (this is what made /account/sessions look empty before).
    const current = Boolean(s?.current ?? s?.isCurrent ?? s?.is_current);
    const id = String(s?.id ?? '');
    const ua = String(s?.userAgent ?? s?.user_agent ?? s?.device ?? '');
    const device = AccountSessionDeviceService.label(ua) || this.t('account.sessions.unknownDevice');
    const ip = String(s?.ipAddress ?? s?.ip_address ?? s?.ip ?? '').trim();
    const started = this.formatDate(s?.lastActiveAt ?? s?.last_active_at ?? s?.lastActivityAt ?? s?.last_activity_at ?? s?.createdAt ?? s?.created_at);
    const busy = this.revokingId === id;
    return (
      <div className={AccountClass.of('row')} key={id || i}>
        <div className={AccountClass.of('row-main')}>
          <div className={AccountClass.of('row-title')}>{device}</div>
          {ip ? <div className={AccountClass.of('row-meta')}>{this.t('account.sessions.ip')}: {ip}</div> : null}
          {started ? <div className={AccountClass.of('row-meta')}>{this.t('account.sessions.created')}: {started}</div> : null}
        </div>
        <div className={AccountClass.of('row-actions')}>
          {current ? <span className={AccountClass.of('badge')}>{this.t('account.sessions.current')}</span> : null}
          {id ? (
            <button className={AccountClass.of('btn', 'small')} onClick={() => void this.revokeOne(id)} disabled={busy}>
              {busy ? this.t('account.sessions.revokingOne') : this.t('account.sessions.revoke')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { loading, revoking, error, sessions } = this;
    if (loading) return <div className={AccountClass.of('card')}>{this.t('account.sessions.loading')}</div>;
    return (
      <div className={AccountClass.of('card')}>
        <h2 className={AccountClass.of('h2')}>{this.t('account.section.sessions')}</h2>
        {error ? <p className={AccountClass.of('error')}>{error}</p> : null}
        <div className={AccountClass.of('list')}>
          {sessions.map((s, i) => this.renderRow(s, i))}
          {sessions.length === 0 ? <p className={AccountClass.of('empty-note')}>{this.t('account.sessions.none')}</p> : null}
        </div>
        <button className={AccountClass.of('btn', 'muted')} onClick={() => void this.revokeOthers()} disabled={revoking}>
          {revoking ? this.t('account.sessions.revoking') : this.t('account.sessions.revokeOthers')}
        </button>
      </div>
    );
  }
}
