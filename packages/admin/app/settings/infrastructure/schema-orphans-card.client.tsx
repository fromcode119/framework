import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

interface IUndeclaredColumn {
  table: string;
  column: string;
  rows?: number;
  nonEmpty?: number;
  sample?: string;
  firstSeenAt: string;
  inactivePluginsAtScan?: string[];
}

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

  private renderEntry(entry: IUndeclaredColumn): ReactNode {
    const holdsData = entry.nonEmpty === undefined || entry.nonEmpty > 0;
    const plugins = entry.inactivePluginsAtScan ?? [];
    return (
      <li key={`${entry.table}.${entry.column}`} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div className="min-w-0 text-sm">
          <p className="font-mono font-semibold break-all">{entry.table}.{entry.column}</p>
          <p className={`text-xs ${holdsData ? 'text-amber-600' : 'text-slate-500'}`}>{this.contents(entry)}</p>
          {entry.sample ? <p className="text-xs text-slate-500 break-all">{AdminI18n.t('settings.infrastructure.schemaOrphanSample', { sample: entry.sample })}</p> : null}
          {plugins.length ? <p className="text-xs text-amber-600">{AdminI18n.t('settings.infrastructure.schemaOrphanInactivePlugins', { plugins: plugins.join(', ') })}</p> : null}
          <p className="text-xs text-slate-500">{AdminI18n.t('settings.infrastructure.schemaOrphanSince', { time: new Date(entry.firstSeenAt).toLocaleString() })}</p>
        </div>
        <Button onClick={() => { this.pending = entry; }} icon={<FrameworkIcons.Trash size={13} />} className="h-9 px-3 rounded-xl text-[11px] font-bold shrink-0">
          {AdminI18n.t('settings.infrastructure.schemaOrphanDrop')}
        </Button>
      </li>
    );
  }

  private renderBody(): ReactNode {
    if (this.loadFailed) return <p className="text-sm text-amber-600">{AdminI18n.t('settings.infrastructure.schemaOrphansUnavailable')}</p>;
    if (!this.loaded) return <p className="text-sm text-slate-500">{AdminI18n.t('settings.infrastructure.schemaOrphansLoading')}</p>;
    if (!this.columns.length) return <p className="text-sm text-slate-500">{AdminI18n.t('settings.infrastructure.schemaOrphansNone')}</p>;
    return <ul>{this.columns.map((entry) => this.renderEntry(entry))}</ul>;
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.infrastructure.schemaOrphans')}>
        <p className="text-sm text-slate-500 mb-3">{AdminI18n.t('settings.infrastructure.schemaOrphansHelp')}</p>
        {this.renderBody()}
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
