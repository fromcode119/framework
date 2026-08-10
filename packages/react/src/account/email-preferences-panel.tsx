import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { SdkClient } from '@fromcode119/core/client';

/**
 * Which emails this person wants — the account's half of the unsubscribe link.
 *
 * Before this the only control was the link at the bottom of a message: one click, one direction, and
 * no way back. Someone who unsubscribed by accident had no route to undo it, and nobody could see what
 * they were signed up to. Framework-owned rather than per-plugin because the suppression list is
 * framework-owned and eight plugins send mail — one screen listing every declared stream, not one
 * screen per sender.
 *
 * Only DECLARED streams appear (`context.email.registerCategory`). Transactional mail — receipts,
 * password resets, shipping notices — carries no category, cannot be switched off, and is deliberately
 * absent: offering a toggle that does nothing would be worse than offering none.
 */
export class AccountEmailPreferencesPanel extends PluginComponent {
  @state loading: boolean = true;
  @state saving: string = '';
  @state error: string = '';
  @state address: string = '';
  @state preferences: any[] = [];

  static readonly accountSection = {
    key: 'email-preferences',
    labelKey: 'account.section.emailPreferences',
    priority: 70,
    descriptionKey: 'account.description.emailPreferences',
  };

  private mounted = false;

  /**
   * The SYSTEM scope, not the auth scope the sibling panels use. Sessions and two-factor live on
   * `/api/v1/auth/*`; these routes are on the system router, so the auth client resolved
   * `/api/v1/auth/email-preferences` and the panel rendered "HTTP 404" over an empty list.
   */
  protected get client(): any {
    return new SdkClient(this.api).getSystem();
  }

  /**
   * Which endpoint answers for this viewer. The session-scoped one here; the token-authenticated twin
   * overrides it. These three hooks are the ONLY things that differ between the two surfaces, so the
   * rest is inherited rather than copied.
   */
  protected get preferencesPath(): string {
    return RouteConstants.SEGMENTS.EMAIL_PREFERENCES;
  }

  protected get updatePath(): string {
    return RouteConstants.SEGMENTS.EMAIL_PREFERENCES;
  }

  protected buildUpdateBody(key: string, subscribed: boolean): Record<string, unknown> {
    return { key, subscribed };
  }

  /**
   * What the viewer is told when a request fails.
   *
   * This is an ACCOUNT screen, so the raw message is at worst confusing to someone already signed in.
   * The public page overrides it: an exception string is never customer-facing copy.
   */
  protected describeError(error: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    return String(error?.message || error);
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  protected async load(): Promise<void> {
    try {
      const data = await this.client.get(this.preferencesPath, { silent: true });
      const body = data?.data ?? data;
      if (!this.mounted) return;
      this.setState({
        address: String(body?.address || ''),
        preferences: Array.isArray(body?.preferences) ? body.preferences : [],
        loading: false,
      });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: this.describeError(error), loading: false });
    }
  }

  /**
   * Optimistic, then reconciled from the server's answer.
   *
   * A toggle that waits for a round trip before moving reads as broken, but the server is the authority
   * on what was actually stored — so the switch flips at once and `load()` settles it.
   */
  protected async toggle(key: string, subscribed: boolean): Promise<void> {
    this.setState({
      saving: key,
      error: '',
      preferences: this.preferences.map((p: any) => (p?.key === key ? { ...p, subscribed } : p)),
    });
    try {
      await this.client.post(this.updatePath, this.buildUpdateBody(key, subscribed));
      await this.load();
    } catch (error: any) {
      if (this.mounted) this.setState({ error: this.describeError(error) });
      await this.load();
    } finally {
      if (this.mounted) this.setState({ saving: '' });
    }
  }

  render(): ReactNode {
    if (this.loading) {
      return <p className="fc-acct-loading">{this.t('account.emailPreferences.loading', {}, 'Loading…')}</p>;
    }

    return (
      <div className="fc-acct-card">
        {this.address ? (
          <p className="fc-acct-muted">
            {this.t('account.emailPreferences.intro', { address: this.address }, `Sent to ${this.address}`)}
          </p>
        ) : null}

        {this.error ? <p className="fc-acct-error">{this.error}</p> : null}

        {!this.preferences.length ? (
          <p className="fc-acct-empty">
            {this.t('account.emailPreferences.empty', {}, 'There are no optional emails to manage.')}
          </p>
        ) : (
          <ul className="fc-acct-rows">
            {this.preferences.map((preference: any) => (
              <li key={preference.key} className="fc-acct-row">
                <div className="fc-acct-row-main">
                  <div className="fc-acct-row-title">{preference.label}</div>
                  {preference.description
                    ? <div className="fc-acct-row-meta">{preference.description}</div>
                    : null}
                </div>
                <label className="fc-acct-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(preference.subscribed)}
                    disabled={this.saving === preference.key}
                    onChange={(event) => void this.toggle(preference.key, event.target.checked)}
                  />
                  <span className="fc-acct-switch-track" aria-hidden="true" />
                  <span className="fc-acct-switch-label">
                    {preference.subscribed
                      ? this.t('account.emailPreferences.on', {}, 'On')
                      : this.t('account.emailPreferences.off', {}, 'Off')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="fc-acct-note">
          {this.t(
            'account.emailPreferences.transactionalNote',
            {},
            'Order confirmations, receipts and account security emails are always sent and cannot be switched off.',
          )}
        </p>
      </div>
    );
  }
}
