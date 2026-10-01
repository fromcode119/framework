import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { CoercionUtils, PushNotificationWorker, RouteConstants, SdkClient } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountTranslations } from '@react/account/account-translations';
import { PushDevice } from '@react/push/push-device';
import { AccountChannelPreferences } from '@react/account/channel-preferences';

/**
 * Account → Notifications: whether THIS device shows the site's notifications.
 *
 * Framework-owned for the reason email preferences are: the devices are the framework's, and every
 * plugin that tells a customer something reaches them through the same channel — one switch, not one
 * per sender. The switch reads the browser itself, so it shows what the browser will actually do.
 */
export class AccountPushNotificationsPanel extends PluginComponent {
  static readonly accountSection = {
    key: 'notifications',
    labelKey: 'account.section.notifications',
    priority: 65,
    descriptionKey: 'account.description.notifications',
  };

  @state loading = true;
  @state on = false;
  @state busy = false;
  @state otherDevices = 0;
  /** The translation KEY of what went wrong, rendered in the reader's language at render time. */
  @state problem = '';

  private get system(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return new SdkClient(this.api).getSystem();
  }

  private get device(): PushDevice {
    return new PushDevice({
      workerUrl: PushNotificationWorker.STOREFRONT_SCRIPT,
      scope: '/',
      surface: 'storefront',
      requests: {
        publicKey: async () => CoercionUtils.toString((await this.system.get(RouteConstants.SEGMENTS.PUSH_KEY, { noDedupe: true }))?.publicKey),
        save: async (body) => { await this.system.post(RouteConstants.SEGMENTS.PUSH_SUBSCRIPTIONS, body); },
        remove: async (endpoint) => { await this.system.post(RouteConstants.SEGMENTS.PUSH_SUBSCRIPTIONS_REMOVE, { endpoint }); },
      },
    });
  }

  componentDidMount(): void {
    AccountTranslations.register();
    void this.load();
  }

  private async load(): Promise<void> {
    const on = await this.device.isOn().catch(() => false);
    const devices = await this.system.get(RouteConstants.SEGMENTS.PUSH_SUBSCRIPTIONS, { silent: true, noDedupe: true }).catch(() => null);
    const storefront = CoercionUtils.toArray(devices?.devices).filter((device: any) => device?.surface === 'storefront'); // eslint-disable-line @typescript-eslint/no-explicit-any
    this.setState({ on, otherDevices: Math.max(0, storefront.length - (on ? 1 : 0)), loading: false });
  }

  @bound
  async toggle(event: { target: { checked: boolean } }): Promise<void> {
    const wanted = event.target.checked;
    this.setState({ busy: true, problem: '' });
    try {
      if (wanted && !(await this.device.turnOn())) this.problem = PushDevice.blocked ? 'account.notifications.blocked' : 'account.notifications.declined';
      if (!wanted) await this.device.turnOff();
    } catch (error) {
      console.warn('[notifications] could not change this device:', String((error as Error)?.message || error));
      this.problem = 'account.notifications.failed';
    }
    await this.load();
    this.busy = false;
  }

  render(): ReactNode {
    if (this.loading) return <p className="fc-acct-loading">{this.t('account.notifications.loading', {}, 'Loading…')}</p>;
    const supported = PushDevice.supported;
    return (
      <div className="fc-acct-card">
        {!supported ? <p className="fc-acct-muted">{this.t('account.notifications.unsupported', {}, 'This browser cannot show notifications.')}</p> : null}
        {supported && PushDevice.blocked && !this.on ? <p className="fc-acct-muted">{this.t('account.notifications.blocked', {}, 'Notifications are blocked for this site in your browser.')}</p> : null}
        {this.problem ? <p className="fc-acct-error">{this.t(this.problem, {}, 'That did not work. Please try again.')}</p> : null}
        <ul className="fc-acct-rows">
          <li className="fc-acct-row">
            <div className="fc-acct-row-main">
              <div className="fc-acct-row-title">{this.t('account.notifications.device', {}, 'This device')}</div>
              <div className="fc-acct-row-meta">{this.t('account.notifications.deviceDetail', {}, 'Updates about your orders, bookings and support conversations.')}</div>
            </div>
            <label className="fc-acct-switch">
              <input type="checkbox" checked={this.on} disabled={!supported || this.busy} onChange={this.toggle} />
              <span className="fc-acct-switch-track" aria-hidden="true" />
              <span className="fc-acct-switch-label">{this.on ? this.t('account.notifications.on', {}, 'On') : this.t('account.notifications.off', {}, 'Off')}</span>
            </label>
          </li>
        </ul>
        <AccountChannelPreferences pushSupported={supported} />
        {this.otherDevices > 0 ? <p className="fc-acct-note">{this.t('account.notifications.others', { count: this.otherDevices }, `Notifications are on for ${this.otherDevices} of your other devices.`)}</p> : null}
      </div>
    );
  }
}
