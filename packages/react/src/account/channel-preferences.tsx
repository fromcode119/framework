import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { CoercionUtils, RouteConstants, SdkClient } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountClass } from '@react/account/account-class';

/**
 * Account → Notifications, second half: what a person agreed to be sent besides this device's
 * notifications — texts for updates, texts for offers, and offers as notifications. Each switch is a
 * recorded agreement on the site; the number is taken with its country code and kept with the
 * agreement. Texts are offered only when the site has a text-message provider.
 */
export class AccountChannelPreferences extends PluginComponent {
  /** Whether this browser can show notifications at all — the offers-as-notifications switch needs it. */
  @prop declare pushSupported: boolean;
  @state loaded = false;
  @state available = false;
  @state phone = '';
  @state updates = false;
  @state offers = false;
  @state pushOffers = false;
  @state busy = '';
  @state error = '';
  /** The switch waiting for the code texted to the number — set while the code box is shown. */
  @state pending: { key: string; channel: string; category: string } | null = null;
  @state code = '';

  private get system(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return new SdkClient(this.api).getSystem();
  }

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const data = await this.system.get(RouteConstants.SEGMENTS.NOTIFICATION_PREFERENCES, { silent: true, noDedupe: true }).catch(() => null);
    if (!data) return;
    this.setState({
      loaded: true,
      available: data.sms?.available === true,
      phone: this.phone || CoercionUtils.toString(data.sms?.phone),
      updates: data.sms?.updates === true,
      offers: data.sms?.offers === true,
      pushOffers: data.push?.offers === true,
    });
  }

  @bound
  changePhone(event: { target: { value: string } }): void {
    this.phone = event.target.value;
  }

  @bound
  changeCode(event: { target: { value: string } }): void {
    this.code = event.target.value;
  }

  @bound
  confirmCode(): void {
    const pending = this.pending;
    if (pending) void this.set(pending.key, pending.channel, pending.category, true, this.code);
  }

  /**
   * Turning texts on for a number not yet confirmed answers `verificationRequired`: a code was texted
   * to it, and the same switch is sent again with that code.
   */
  private async set(key: string, channel: string, category: string, enabled: boolean, code = ''): Promise<void> {
    this.setState({ busy: key, error: '' });
    try {
      const result = await this.system.post(RouteConstants.SEGMENTS.NOTIFICATION_PREFERENCES, { channel, category, enabled, phone: this.phone, code });
      this.setState(result?.verificationRequired === true ? { pending: { key, channel, category }, code: '' } : { pending: null, code: '' });
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      this.error = String(error?.data?.error || error?.message || error);
    }
    await this.load();
    this.busy = '';
  }

  private codeBox(): ReactNode {
    if (!this.pending) return null;
    return (
      <div className={AccountClass.of('block')}>
        <div className={AccountClass.of('block-label')}>{this.t('account.notifications.codeSent', { phone: this.phone }, 'We sent a code to {{phone}}. Enter it to switch texts on.')}</div>
        <form className={AccountClass.of('inline-form')} onSubmit={(event) => { event.preventDefault(); this.confirmCode(); }}>
          <input className={AccountClass.of('input')} value={this.code} onChange={this.changeCode} autoComplete="one-time-code" inputMode="numeric" />
          <button className={AccountClass.of('btn')} type="submit" disabled={!this.code.trim() || Boolean(this.busy)}>{this.t('account.notifications.confirmCode', {}, 'Confirm')}</button>
        </form>
      </div>
    );
  }

  private row(key: string, title: string, detail: string, on: boolean, change: (enabled: boolean) => void, disabled = false): ReactNode {
    return (
      <li className="fc-acct-row" key={key}>
        <div className="fc-acct-row-main">
          <div className="fc-acct-row-title">{title}</div>
          <div className="fc-acct-row-meta">{detail}</div>
        </div>
        <label className="fc-acct-switch">
          <input type="checkbox" checked={on} disabled={disabled || this.busy === key} onChange={(event) => change(event.target.checked)} />
          <span className="fc-acct-switch-track" aria-hidden="true" />
          <span className="fc-acct-switch-label">{on ? this.t('account.notifications.on', {}, 'On') : this.t('account.notifications.off', {}, 'Off')}</span>
        </label>
      </li>
    );
  }

  render(): ReactNode {
    if (!this.loaded) return null;
    return (
      <>
        {this.error ? <p className="fc-acct-error">{this.error}</p> : null}
        <ul className="fc-acct-rows">
          {this.pushSupported
            ? this.row('push-offers', this.t('account.notifications.offersAsNotifications', {}, 'Offers as notifications'), this.t('account.notifications.offersAsNotificationsDetail', {}, 'News and offers on the devices where notifications are on.'), this.pushOffers, (on) => void this.set('push-offers', 'push', 'offers', on))
            : null}
        </ul>
        <h3 className="fc-acct-row-title">{this.t('account.notifications.textsTitle', {}, 'Text messages')}</h3>
        {!this.available ? <p className="fc-acct-muted">{this.t('account.notifications.textsUnavailable', {}, 'This site does not send text messages.')}</p> : (
          <>
            <label className="fc-acct-row-meta" htmlFor="fc-acct-sms-phone">{this.t('account.notifications.phone', {}, 'Mobile number')}</label>
            <input id="fc-acct-sms-phone" className="fc-acct-input" type="tel" autoComplete="tel" value={this.phone} onChange={this.changePhone} placeholder={this.t('account.notifications.phoneHint', {}, 'With your country code, e.g. +359 88 123 4567')} />
            <ul className="fc-acct-rows">
              {this.row('sms-updates', this.t('account.notifications.updatesByText', {}, 'Updates by text'), this.t('account.notifications.updatesByTextDetail', {}, 'Your orders, bookings and support replies.'), this.updates, (on) => void this.set('sms-updates', 'sms', 'updates', on))}
              {this.row('sms-offers', this.t('account.notifications.offersByText', {}, 'Offers by text'), this.t('account.notifications.offersByTextDetail', {}, 'News and offers, now and then. Reply STOP to stop them.'), this.offers, (on) => void this.set('sms-offers', 'sms', 'offers', on))}
            </ul>
            {this.codeBox()}
          </>
        )}
      </>
    );
  }
}
