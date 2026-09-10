import { ThemeMode, SystemConstants } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/security/setting-row';

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
      <Card title="Audit Trail">
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Database}
          title="Tables Excluded From Write Auditing"
          description="Physical table names, comma separated. Plugin database writes to these tables are not recorded in the audit log — meant for high-volume telemetry tables whose per-row writes would drown the trail. Clear it and every plugin write is audited. Applies within a minute of saving."
        >
          <Input
            className="w-80"
            value={this.settings[SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES] ?? ''}
            onChange={this.setExcludedTables}
            placeholder="fcp_analytics_events, fcp_analytics_sessions"
          />
        </SettingRow>
      </Card>
    );
  }
}
