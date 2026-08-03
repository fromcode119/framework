import { state } from '@fromcode119/reactor';
import type { IAccountTwoFactorPanelState } from '@react/account/interfaces/account-two-factor-panel-state.interface';
import type { ReactNode } from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountClass } from '@react/account/account-class';

/** Plugin-owned default Two-Factor section for the framework AccountShell. Shows 2FA status and runs
 * the setup → verify → disable flow against the framework auth API. Registered into `account.panels`. */
export class AccountTwoFactorPanel extends PluginComponent {
  @state loading: boolean = true;
  @state busy: boolean = false;
  @state enabled: boolean = false;
  @state setupSecret: string = '';
  @state qrCode: string = '';
  @state recoveryCodes: string[] = [];
  @state token: string = '';
  @state message: string = '';
  @state isError: boolean = false;
  static readonly accountSection = { key: 'two-factor', labelKey: 'account.section.two-factor', priority: 70, descriptionKey: 'account.description.two-factor' };

  private mounted = false;
  
  componentDidMount(): void {
    this.mounted = true;
    void this.loadStatus();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get auth(): any {
    return AccountAuthClient.of(this.api);
  }

  private async loadStatus(): Promise<void> {
    try {
      const data = await this.auth.get(RouteConstants.SEGMENTS.TWO_FACTOR_STATUS, { silent: true });
      if (this.mounted) this.setState({ enabled: Boolean(data?.enabled ?? data?.twoFactorEnabled), loading: false });
    } catch {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async startSetup(): Promise<void> {
    this.setState({ busy: true, message: '', isError: false });
    try {
      const data = await this.auth.post(RouteConstants.SEGMENTS.TWO_FACTOR_SETUP, {});
      if (this.mounted) this.setState({ busy: false, setupSecret: String(data?.secret ?? data?.manualKey ?? data?.otpauthUrl ?? ''), qrCode: String(data?.qrCode ?? data?.qr ?? ''), recoveryCodes: Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : [] });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.failed')) });
    }
  }

  private async verify(): Promise<void> {
    if (!this.token) return;
    this.setState({ busy: true, message: '', isError: false });
    try {
      await this.auth.post(RouteConstants.SEGMENTS.TWO_FACTOR_VERIFY, { token: this.token });
      if (this.mounted) this.setState({ busy: false, enabled: true, setupSecret: '', token: '', isError: false, message: this.t('account.twoFactor.enabledMsg') });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.invalidToken')) });
    }
  }

  private async disable(): Promise<void> {
    this.setState({ busy: true, message: '', isError: false });
    try {
      await this.auth.delete(RouteConstants.SEGMENTS.TWO_FACTOR_DISABLE);
      if (this.mounted) this.setState({ busy: false, enabled: false, message: this.t('account.twoFactor.disabledMsg'), isError: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.failed')) });
    }
  }

  render(): ReactNode {
    const { loading, busy, enabled, setupSecret, qrCode, recoveryCodes, token, message, isError } = this;
    if (loading) return <div className={AccountClass.of('card')}>{this.t('account.twoFactor.loading')}</div>;
    return (
      <div className={AccountClass.of('card')}>
        <h2 className={AccountClass.of('h2')}>{this.t('account.section.two-factor')}</h2>
        <p className={AccountClass.of('muted')}>{enabled ? this.t('account.twoFactor.on') : this.t('account.twoFactor.off')}</p>
        {message ? <p className={AccountClass.of(isError ? 'error' : 'success')}>{message}</p> : null}

        {enabled ? (
          <button className={AccountClass.of('btn', 'danger')} onClick={() => void this.disable()} disabled={busy}>
            {this.t('account.twoFactor.disable')}
          </button>
        ) : setupSecret ? (
          <div>
            <p className={AccountClass.of('hint')}>{this.t('account.twoFactor.scanKey')}</p>
            {qrCode ? <img className={AccountClass.of('qr')} src={qrCode} alt={this.t('account.twoFactor.qrAlt', undefined, 'Two-factor QR code')} /> : null}
            <code className={AccountClass.of('code')}>{setupSecret}</code>
            {recoveryCodes.length ? (
              <div className={AccountClass.of('block')}>
                <div className={AccountClass.of('block-label')}>{this.t('account.twoFactor.recoveryCodes')}</div>
                <code className={AccountClass.of('code')}>{recoveryCodes.join('  ')}</code>
              </div>
            ) : null}
            <form className={AccountClass.of('inline-form')} onSubmit={(e) => { e.preventDefault(); void this.verify(); }}>
              <input
                className={AccountClass.of('input')}
                value={token}
                onChange={(e) => this.setState({ token: e.target.value })}
                placeholder={this.t('account.twoFactor.tokenPlaceholder')}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              <button className={AccountClass.of('btn')} type="submit" disabled={busy}>{this.t('account.twoFactor.verify')}</button>
            </form>
          </div>
        ) : (
          <button className={AccountClass.of('btn')} onClick={() => void this.startSetup()} disabled={busy}>
            {this.t('account.twoFactor.enable')}
          </button>
        )}
      </div>
    );
  }
}
