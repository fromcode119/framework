import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Hint } from '@/components/ui/view/hint.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IUndeclaredColumn } from '@/app/settings/infrastructure/interfaces/undeclared-column.interface';

/**
 * The database-schema review (Settings → Infrastructure): columns the database holds that nothing
 * declares any more, with what each one still contains, and the decision to drop it.
 *
 * Nothing is dropped automatically — the framework only records what it found. Counts are taken when
 * this card loads; a column whose rows could not be counted says so and is never shown as empty.
 */
export class SchemaOrphansCard extends AdminComponent {
  @state columns: IUndeclaredColumn[] = [];
  @state loaded = false;
  @state loadFailed = false;
  @state pending: IUndeclaredColumn | null = null;
  @state dropping = false;

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loadFailed = false;
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SCHEMA_ORPHANS);
      this.columns = Array.isArray(response?.columns) ? response.columns : [];
      this.loaded = true;
    } catch (err: any) {
      this.loadFailed = true;
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.schemaOrphansUnavailable'), err?.message || '');
    }
  }

  @bound
  async drop(): Promise<void> {
    const target = this.pending;
    if (!target) return;
    this.dropping = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.SCHEMA_ORPHANS_DROP, { table: target.table, column: target.column });
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.schemaOrphanDropped'), `${target.table}.${target.column}`);
      this.pending = null;
      await this.load();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.schemaOrphanDropFailed'), err?.message || '');
    } finally {
      this.dropping = false;
    }
  }

  @bound close(): void { this.pending = null; }

  private contents(entry: IUndeclaredColumn): string {
    if (entry.rows === undefined || entry.nonEmpty === undefined) return AdminI18n.t('settings.infrastructure.schemaOrphanNotCounted');
    if (entry.nonEmpty === 0) return AdminI18n.t('settings.infrastructure.schemaOrphanEmpty', { rows: entry.rows });
    return AdminI18n.t('settings.infrastructure.schemaOrphanHoldsValues', { count: entry.nonEmpty, rows: entry.rows });
  }

  private confirmText(entry: IUndeclaredColumn): string {
    return `${AdminI18n.t('settings.infrastructure.schemaOrphanDropWarning', { name: `${entry.table}.${entry.column}` })} ${this.contents(entry)}`;
  }

  /** One column: its name and what it holds, Drop at the end; under it what to know before dropping. */
  private renderEntry(entry: IUndeclaredColumn): ReactNode {
    const plugins = entry.inactivePluginsAtScan ?? [];
    const name = `${entry.table}.${entry.column}`;
    return (
      <Fragment key={name}>
        <SettingRow title={<code className="fc-code">{name}</code>} description={this.contents(entry)} width={SettingRowWidth.AUTO}>
          <div className="fc-settings-group">
            <Button variant={ButtonVariant.SECONDARY} onClick={() => { this.pending = entry; }} icon={<FrameworkIcons.Trash size={13} />}>
              {AdminI18n.t('settings.infrastructure.schemaOrphanDrop')}
            </Button>
          </div>
        </SettingRow>
        <div className="fc-settings-note fc-settings-note--of-row">
          {plugins.length ? <Hint variant="warning">{AdminI18n.t('settings.infrastructure.schemaOrphanInactivePlugins', { plugins: plugins.join(', ') })}</Hint> : null}
          {entry.sample ? <Hint>{AdminI18n.t('settings.infrastructure.schemaOrphanSample', { sample: entry.sample })}</Hint> : null}
          <Hint>{AdminI18n.t('settings.infrastructure.schemaOrphanSince', { time: new Date(entry.firstSeenAt).toLocaleString() })}</Hint>
        </div>
      </Fragment>
    );
  }

  /** The state of the scan when there is no column to list. */
  private renderState(): ReactNode {
    if (this.loadFailed) return <Hint variant="error">{AdminI18n.t('settings.infrastructure.schemaOrphansUnavailable')}</Hint>;
    if (!this.loaded) return <Hint>{AdminI18n.t('settings.infrastructure.schemaOrphansLoading')}</Hint>;
    return <Hint variant="success">{AdminI18n.t('settings.infrastructure.schemaOrphansNone')}</Hint>;
  }

  render(): ReactNode {
    const listed = this.loaded && !this.loadFailed && this.columns.length > 0;
    return (
      <Card title={AdminI18n.t('settings.infrastructure.schemaOrphans')}>
        <div className="fc-settings-note">
          <Hint>{AdminI18n.t('settings.infrastructure.schemaOrphansHelp')}</Hint>
          {listed ? null : this.renderState()}
        </div>
        {listed ? this.columns.map((entry) => this.renderEntry(entry)) : null}
        <ConfirmDialog
          isOpen={this.pending !== null}
          onClose={this.close}
          onConfirm={this.drop}
          isLoading={this.dropping}
          title={AdminI18n.t('settings.infrastructure.schemaOrphanDropTitle')}
          description={this.pending ? this.confirmText(this.pending) : ''}
          confirmLabel={AdminI18n.t('settings.infrastructure.schemaOrphanDrop')}
        />
      </Card>
    );
  }
}
