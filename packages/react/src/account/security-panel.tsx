import { state } from '@fromcode119/reactor';
import type { IAccountSecurityPanelState } from '@react/account/interfaces/account-security-panel-state.interface';
import { PasswordFieldName } from '@react/account/enums/password-field-name.enum';
import type { ReactNode } from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountClass } from '@react/account/account-class';

/** Plugin-owned default Security section for the framework AccountShell. Lets the signed-in user
 * change their password via the framework auth API (CSRF-protected). Registered into `account.panels`. */
export class AccountSecurityPanel extends PluginComponent {
  @state currentPassword: string = '';
  @state newPassword: string = '';
  @state saving: boolean = false;
  @state message: string = '';
  @state isError: boolean = false;
  static readonly accountSection = { key: 'security', labelKey: 'account.section.security', priority: 60, descriptionKey: 'account.description.security' };

  private mounted = false;
  
  componentDidMount(): void { this.mounted = true; }
  componentWillUnmount(): void { this.mounted = false; }

  private async submit(): Promise<void> {
    if (!this.currentPassword || !this.newPassword) return;
    this.setState({ saving: true, message: '', isError: false });
    try {
      await AccountAuthClient.of(this.api).post(RouteConstants.SEGMENTS.CHANGE_PASSWORD, { currentPassword: this.currentPassword, newPassword: this.newPassword });
      if (this.mounted) this.setState({ saving: false, isError: false, message: this.t('account.security.changed'), currentPassword: '', newPassword: '' });
    } catch (error: any) {
      if (this.mounted) this.setState({ saving: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.security.failed')) });
    }
  }

  private input(key: PasswordFieldName, labelKey: string): ReactNode {
    return (
      <label className={AccountClass.of('field')}>
        {this.t(labelKey)}
        <input
          className={AccountClass.of('input')}
          type="password"
          autoComplete={key === PasswordFieldName.NEW_PASSWORD ? 'new-password' : 'current-password'}
          value={(this.state as any)[key.value]}
          onChange={(e) => this.setState({ [key.value]: e.target.value } as any)}
        />
      </label>
    );
  }

  render(): ReactNode {
    const { saving, message, isError } = this;
    return (
      <div className={AccountClass.of('card')}>
        <h2 className={AccountClass.of('h2')}>{this.t('account.section.security')}</h2>
        <form className={AccountClass.of('form')} onSubmit={(e) => { e.preventDefault(); void this.submit(); }}>
          {/* Hidden username field for password-manager / accessibility (browsers warn without one). */}
          <input className={AccountClass.of('sronly')} type="text" name="username" autoComplete="username" aria-hidden="true" tabIndex={-1} readOnly value="" />
          {this.input(PasswordFieldName.CURRENT_PASSWORD, 'account.security.current')}
          {this.input(PasswordFieldName.NEW_PASSWORD, 'account.security.new')}
          {message ? <p className={AccountClass.of(isError ? 'error' : 'success')}>{message}</p> : null}
          <button className={AccountClass.of('btn')} type="submit" disabled={saving}>
            {saving ? this.t('account.security.saving') : this.t('account.security.change')}
          </button>
        </form>
      </div>
    );
  }
}
