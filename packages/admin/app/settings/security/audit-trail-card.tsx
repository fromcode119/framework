import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ReactNode, SetStateAction } from 'react';

import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { TagFieldUtils } from '@/components/ui/tag-field/utils';
import type { IOption } from '@/components/ui/interfaces/option.interface';
import { SettingListRow } from '@/app/settings/security/setting-list-row';
import { SettingListSeparator } from '@/app/settings/security/enums/setting-list-separator.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The audit trail's own controls. Every plugin database write is recorded in the audit log
 * (Activity → Security) as `table/id`; the exclusion list below is the ONE place that decides
 * which tables stay out of it — read live by the framework's plugin database proxy
 * (`DatabaseWriteAudit`), applied within a minute of saving, no restart.
 *
 * The setting stores physical table names. They are picked from the tables the plugins registered
 * ("Analytics · Events"), never typed; a stored name no plugin registers any more still shows, as itself.
 */
export class AuditTrailCard extends Reactor {
  declare props: Pick<AuditTrailCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  @state tables: IOption[] = [];

  async componentDidMount(): Promise<void> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.SETTINGS_AUDIT_TABLES).catch(() => null);
    const rows: Array<{ table: string; plugin: string; collection: string }> = Array.isArray(data?.tables) ? data.tables : [];
    this.tables = rows.map((row) => ({
      value: row.table,
      label: `${TagFieldUtils.inferFieldLabel(row.plugin)} · ${TagFieldUtils.inferFieldLabel(row.collection)}`,
    }));
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.auditTrail')}>
        <SettingListRow
          theme={this.theme}
          settings={this.settings}
          setSettings={this.setSettings}
          settingKey={SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES}
          separator={SettingListSeparator.COMMA}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.security.tablesExcludedFromWriteAuditing')}
          description={AdminI18n.t('settings.security.physicalTableNamesCommaSeparated')}
          options={this.tables}
          placeholder={AdminI18n.t('settings.security.auditNoTablesExcluded')}
        />
      </Card>
    );
  }
}
