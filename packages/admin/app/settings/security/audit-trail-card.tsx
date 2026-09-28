import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The audit trail's own controls. Every plugin database write is recorded in the audit log
 * (Activity → Security) as `table/id`; the exclusion list below is the ONE place that decides
 * which tables stay out of it — read live by the framework's plugin database proxy
 * (`DatabaseWriteAudit`), applied within a minute of saving, no restart.
 */
export class AuditTrailCard extends PureReactor {
  declare props: Pick<AuditTrailCard, 'settings' | 'setSettings' | 'theme'>;

  @prop declare settings: Record<string, string>;
  @prop declare setSettings: (update: SetStateAction<Record<string, string>>) => void;
  @prop declare theme: ThemeMode;

  @bound
  setExcludedTables(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    this.setSettings((prev) => ({ ...prev, [SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES]: value }));
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.security.auditTrail')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.security.tablesExcludedFromWriteAuditing')}
          description={AdminI18n.t('settings.security.physicalTableNamesCommaSeparated')}
        >
          <Input
            className="w-80"
            value={this.settings[SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES] ?? ''}
            onChange={this.setExcludedTables}
            placeholder="fcp_telemetry_events, fcp_telemetry_sessions"
          />
        </SettingRow>
      </Card>
    );
  }
}
