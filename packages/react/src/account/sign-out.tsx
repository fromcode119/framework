import type { ReactNode } from 'react';
import { bound, Platform, state } from '@fromcode119/react-class-components';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountClass } from '@react/account/account-class';

/**
 * "Sign out" at the foot of the account menu. It asks in the page first (a browser confirm dialog is
 * not shown on every surface), then ends the session and reloads, so the account's own sign-in gate
 * takes over: no address is assumed for where a signed-out reader belongs.
 */
export class AccountSignOut extends PluginComponent {
  @state confirming = false;
  @state busy = false;
  @state failed = false;

  @bound
  async signOut(): Promise<void> {
    this.setState({ busy: true, failed: false });
    try {
      await AccountAuthClient.of(this.api).post(RouteConstants.SEGMENTS.LOGOUT, {}, { silent: true });
      if (Platform.hasWindow) window.location.reload();
    } catch (error) {
      console.warn('[account] sign out failed:', String((error as Error)?.message || error));
      this.setState({ busy: false, failed: true });
    }
  }

  render(): ReactNode {
    const t = (key: string, fallback: string) => this.t(key, undefined, fallback);
    if (!this.confirming) {
      return (
        <button type="button" className={AccountClass.of('signout')} onClick={() => this.setState({ confirming: true, failed: false })}>
          {t('account.shell.signOut', 'Sign out')}
        </button>
      );
    }
    return (
      <div className={AccountClass.of('signout-confirm')} role="group">
        <span>{t('account.shell.signOutConfirm', 'Sign out of your account?')}</span>
        {this.failed ? <span className={AccountClass.of('signout-error')}>{t('account.shell.signOutFailed', 'Could not sign out. Try again.')}</span> : null}
        <div className={AccountClass.of('signout-actions')}>
          <button type="button" className={AccountClass.of('signout-yes')} disabled={this.busy} onClick={this.signOut}>
            {this.busy ? t('account.shell.signingOut', 'Signing out…') : t('account.shell.signOutYes', 'Sign out')}
          </button>
          <button type="button" className={AccountClass.of('signout-no')} disabled={this.busy} onClick={() => this.setState({ confirming: false })}>
            {t('account.shell.signOutNo', 'Stay signed in')}
          </button>
        </div>
      </div>
    );
  }
}
