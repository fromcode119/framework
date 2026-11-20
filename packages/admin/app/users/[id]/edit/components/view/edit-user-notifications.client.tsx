import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { Alert } from '@/components/ui/view/alert.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { IAlertPreference } from '@/app/users/[id]/edit/interfaces/alert-preference.interface';

/**
 * What a person is emailed, and the switch for each.
 *
 * On someone's OWN profile it acts for the signed-in session (the framework takes the address from it);
 * given a `userId`, an administrator sets another person's, through the admin route that checks the
 * account belongs to this site. Two lists either way: the alerts sent to administrators (offered only for
 * an administrator — anyone else is refused the list and sees no section), and the optional emails any
 * member receives. Nothing is hardcoded here: a plugin that
 * declares a stream appears with its own words, and the framework's own alerts are worded in this
 * console's dictionary.
 *
 * A switch that moves is written by the page's save bar, together with the rest of the profile; only
 * the streams whose switch changed are sent.
 */
export class EditUserNotifications extends AdminComponent {
  declare props: Pick<EditUserNotifications, 'userId'>;

  /** Set when an administrator is editing ANOTHER person; omitted on one's own profile. */
  @prop declare userId?: string;

  @state loading = true;
  @state failed = false;
  @state alerts: IAlertPreference[] = [];
  @state emails: IAlertPreference[] = [];

  /** The `audience` the preferences API takes: the alerts sent to administrators, or the emails a member gets. */
  private static readonly ADMINS = 'admin';
  private static readonly MEMBERS = 'person';

  private mounted = false;
  private pending: PendingSave | null = null;
  /** What the server last said is stored, by stream key — what a save compares against. */
  private stored: Record<string, boolean> = {};

  componentDidMount(): void {
    this.mounted = true;
    this.pending = new PendingSave(() => this.choices(), () => this.save(), (values: Record<string, boolean>) => this.apply(values));
    void this.load();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
  }

  /** Every switch on screen, by stream key. */
  private choices(): Record<string, boolean> {
    return Object.fromEntries([...this.alerts, ...this.emails].map((row) => [row.key, row.subscribed]));
  }

  private apply(values: Record<string, boolean>): void {
    const set = (rows: IAlertPreference[]) => rows.map((row) => (row.key in values ? { ...row, subscribed: values[row.key] } : row));
    this.alerts = set(this.alerts);
    this.emails = set(this.emails);
  }

  private setOne(key: string, subscribed: boolean): void {
    this.apply({ [key]: subscribed });
  }

  /** Another person's streams are read and written on the admin route; one's own on the session's. */
  private get endpoint(): string {
    return this.userId
      ? AdminConstants.ENDPOINTS.SYSTEM.USER_EMAIL_PREFERENCES(this.userId)
      : AdminConstants.ENDPOINTS.SYSTEM.EMAIL_PREFERENCES;
  }

  private async fetchStreams(audience: string): Promise<IAlertPreference[]> {
    try {
      const data = await AdminApi.get(`${this.endpoint}?audience=${audience}`);
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
      this.stored = this.choices();
      this.pending?.mark();
    } catch {
      if (this.mounted) this.failed = true;
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async save(): Promise<void> {
    const changed = Object.entries(this.choices()).filter(([key, subscribed]) => this.stored[key] !== subscribed);
    this.failed = false;
    let refused = false;
    for (const [key, subscribed] of changed) {
      try {
        await AdminApi.post(this.endpoint, { key, subscribed });
      } catch {
        refused = true;
      }
    }
    // The server decides what was stored, so the switches settle from its answer, not from the click.
    await this.load();
    if (refused) {
      this.failed = true;
      this.pending?.failed();
    }
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
      <Card title={title} description={intro} noPadding>
        {rows.map((row) => (
          <SettingRow
            key={row.key}
            theme={this.theme.value}
            title={this.labelOf(row)}
            description={row.locked
              ? `${this.descriptionOf(row)} ${AdminI18n.t('users.notifications.locked')}`.trim()
              : this.descriptionOf(row)}
            width={SettingRowWidth.AUTO}
          >
            <Switch checked={row.subscribed} disabled={row.locked} onChange={(checked) => this.setOne(row.key, checked)} />
          </SettingRow>
        ))}
      </Card>
    );
  }

  render(): ReactNode {
    if (this.loading) return null;
    const { alerts, emails } = this;
    if (!alerts.length && !emails.length && !this.failed) return null;
    return (
      <div className="fc-stack">
        {this.failed ? <Alert tone="danger">{AdminI18n.t('users.notifications.failed')}</Alert> : null}
        {this.renderList(AdminI18n.t('users.notifications.alertsTitle'), AdminI18n.t(this.userId ? 'users.notifications.alertsIntroOther' : 'users.notifications.alertsIntro'), alerts)}
        {this.renderList(AdminI18n.t('users.notifications.emailsTitle'), AdminI18n.t(this.userId ? 'users.notifications.emailsIntroOther' : 'users.notifications.emailsIntro'), emails)}
      </div>
    );
  }
}
