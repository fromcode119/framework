import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IAlertPreference } from '@/app/users/[id]/edit/interfaces/alert-preference.interface';

/**
 * What the signed-in person is emailed, and the switch for each — on their OWN profile only.
 *
 * Two lists, both read from the framework's preferences API, which takes the address from the session:
 * the alerts sent to administrators (an administrator only — everyone else is refused the list and sees
 * no section), and the optional emails any member receives. Nothing is hardcoded here: a plugin that
 * declares a stream appears with its own words, and the framework's own alerts are worded in this
 * console's dictionary.
 *
 * Every switch saves as it moves. This sits beside the profile form, not inside it, because the
 * form's Save does not carry it.
 */
export class EditUserNotifications extends AdminComponent {
  @state loading = true;
  @state saving = '';
  @state failed = false;
  @state alerts: IAlertPreference[] = [];
  @state emails: IAlertPreference[] = [];

  /** The `audience` the preferences API takes: the alerts sent to administrators, or the emails a member gets. */
  private static readonly ADMINS = 'admin';
  private static readonly MEMBERS = 'person';

  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchStreams(audience: string): Promise<IAlertPreference[]> {
    try {
      const data = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.EMAIL_PREFERENCES}?audience=${audience}`);
      return Array.isArray(data?.preferences) ? data.preferences : [];
    } catch (err: any) {
      // Not an administrator: the alerts are not theirs to see, which is an empty list, not a failure.
      if (audience === EditUserNotifications.ADMINS && Number(err?.status) === 403) return [];
      throw err;
    }
  }

  private async load(): Promise<void> {
    try {
      const [alerts, emails] = await Promise.all([this.fetchStreams(EditUserNotifications.ADMINS), this.fetchStreams(EditUserNotifications.MEMBERS)]);
      if (!this.mounted) return;
      this.alerts = alerts;
      this.emails = emails;
      this.failed = false;
    } catch {
      if (this.mounted) this.failed = true;
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async toggle(key: string, subscribed: boolean): Promise<void> {
    this.saving = key;
    this.failed = false;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EMAIL_PREFERENCES, { key, subscribed });
    } catch {
      if (this.mounted) this.failed = true;
    }
    // The server decides what was stored, so the switches settle from its answer, not from the click.
    await this.load();
    if (this.mounted) this.saving = '';
  }

  /** The sender's own wording when the server could word it, else this console's dictionary's. */
  private wordOf(served: string, key: string): string {
    if (served) return served;
    return key ? AdminI18n.t(key) : '';
  }

  private labelOf(preference: IAlertPreference): string {
    return this.wordOf(preference.label, preference.labelKey);
  }

  private descriptionOf(preference: IAlertPreference): string {
    return this.wordOf(preference.description, preference.descriptionKey);
  }

  private renderList(title: string, intro: string, rows: IAlertPreference[]): ReactNode {
    if (!rows.length) return null;
    return (
      <Card title={title} icon={<FrameworkIcons.Bell size={18} className="text-indigo-500" />}>
        <p className="text-xs font-bold text-slate-500 mb-4">{intro}</p>
        <div className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
          {rows.map((row) => (
            <div key={row.key} className="py-3">
              <Switch
                checked={row.subscribed}
                disabled={row.locked || this.saving === row.key}
                label={this.labelOf(row)}
                description={row.locked
                  ? `${this.descriptionOf(row)} ${AdminI18n.t('users.notifications.locked')}`.trim()
                  : this.descriptionOf(row)}
                onChange={(checked) => this.toggle(row.key, checked)}
              />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  render(): ReactNode {
    if (this.loading) return null;
    const { alerts, emails } = this;
    if (!alerts.length && !emails.length && !this.failed) return null;
    return (
      <div className="space-y-6">
        {this.failed ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3">
            <FrameworkIcons.Warning size={18} />
            {AdminI18n.t('users.notifications.failed')}
          </div>
        ) : null}
        {this.renderList(AdminI18n.t('users.notifications.alertsTitle'), AdminI18n.t('users.notifications.alertsIntro'), alerts)}
        {this.renderList(AdminI18n.t('users.notifications.emailsTitle'), AdminI18n.t('users.notifications.emailsIntro'), emails)}
      </div>
    );
  }
}
