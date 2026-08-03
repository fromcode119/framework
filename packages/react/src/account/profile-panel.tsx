import { state } from '@fromcode119/reactor';
import type { IAccountProfilePanelState } from '@react/account/interfaces/account-profile-panel-state.interface';
import type { ReactNode } from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { AccountAuthClient } from '@react/account/auth-client';
import { AccountClass } from '@react/account/account-class';

export class AccountProfilePanel extends PluginComponent {
  @state loading: boolean = true;
  @state saving: boolean = false;
  @state saved: boolean = false;
  @state error: string = '';
  @state person: Record<string, any> | null = null;
  static readonly accountSection = { key: 'profile', labelKey: 'account.section.profile', priority: 0, descriptionKey: 'account.description.profile' };

  private mounted = false;
  
  private get client(): any {
    return AccountAuthClient.of(this.api);
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      const res = await this.client.get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      const person = res?.person ?? res?.data?.person ?? null;
      if (this.mounted) this.setState({ person: person || {}, loading: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), loading: false });
    }
  }

  private setField(key: string, value: string): void {
    this.setState({ person: { ...(this.person || {}), [key]: value }, saved: false });
  }

  private async save(): Promise<void> {
    const p = this.person || {};
    this.setState({ saving: true, saved: false, error: '' });
    try {
      const res = await this.client.patch(RouteConstants.SEGMENTS.ME_PERSON, {
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        birthDate: p.birthDate ?? '',
        phone: p.phone ?? '',
      });
      const person = res?.person ?? res?.data?.person ?? p;
      if (this.mounted) this.setState({ person, saving: false, saved: true });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), saving: false });
    }
  }

  private renderField(key: string, type: string): ReactNode {
    const p = this.person || {};
    return (
      <label className={AccountClass.of('field')} key={key}>
        {this.t(`account.profile.${key}`)}
        <input
          className={AccountClass.of('input')}
          type={type}
          value={String(p[key] ?? '')}
          onChange={(e) => this.setField(key, e.target.value)}
        />
      </label>
    );
  }

  render(): ReactNode {
    const { loading, saving, saved, error } = this;
    if (loading) return <div className={AccountClass.of('card')}>{this.t('account.profile.loading')}</div>;
    return (
      <div className={AccountClass.of('card')}>
        <h2 className={AccountClass.of('h2')}>{this.t('account.profile.heading')}</h2>
        <div className={AccountClass.of('grid-2')}>
          {this.renderField('firstName', 'text')}
          {this.renderField('lastName', 'text')}
          {this.renderField('birthDate', 'date')}
          {this.renderField('phone', 'tel')}
        </div>
        {error ? <p className={AccountClass.of('error')}>{error}</p> : null}
        <div className={AccountClass.of('actions')}>
          <button className={AccountClass.of('btn')} onClick={() => void this.save()} disabled={saving}>
            {saving ? this.t('account.profile.saving') : this.t('account.profile.save')}
          </button>
          {saved ? <span className={AccountClass.of('success')}>✓ {this.t('account.profile.saved')}</span> : null}
        </div>
      </div>
    );
  }
}
