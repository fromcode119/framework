import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { Columns } from '@/components/ui/view/columns.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SecuritySettingsPageUtils } from '@/app/settings/security/security-settings-page-utils';
import { SecurityProtectionSummary } from '@/app/settings/security/security-protection-summary';
import { SecurityProcessLimits } from '@/app/settings/security/security-process-limits';
import { SecuritySuspiciousActivity } from '@/app/settings/security/security-suspicious-activity';
import { SecurityStoppedAddresses } from '@/app/settings/security/security-stopped-addresses.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Security → Dashboard: what protects the platform (from the saved settings), how its plugins are held
 * apart (from the running processes), and what the monitor recorded. In a site scope the API withholds
 * the process list and host memory — they describe the shared box — and those cards are not shown.
 * The stopped addresses (scanners the gateway refused on every site) are listed under them.
 */
export class SecurityDashboard extends PureReactor {
  declare props: Pick<SecurityDashboard, 'stats' | 'settings' | 'onOpenSettings'>;

  @prop declare stats: any;
  @prop declare settings: Record<string, string> | null;
  @prop declare onOpenSettings: () => void;

  render(): ReactNode {
    const stats = this.stats ?? {};
    const processes: any[] = Array.isArray(stats.sandbox?.processes) ? stats.sandbox.processes : [];
    const isolation = stats.pluginIsolation;
    const violations = Number(stats.monitor?.violations24h || 0);
    return (
      <div className="fc-columns__stack">
        <Columns count={3}>
          {isolation ? <StatCard title={AdminI18n.t('settings.security.isolatedTitle')} value={`${isolation.sandboxActivePlugins} / ${isolation.activePlugins}`}
            icon={<FrameworkIcons.Box size={15} />} note={AdminI18n.t('settings.security.isolatedNote')} /> : null}
          <StatCard title={AdminI18n.t('settings.security.threatAlerts')} value={String(violations)} icon={<FrameworkIcons.ShieldAlert size={15} />}
            tone={violations > 0 ? 'danger' : 'success'} note={AdminI18n.t('settings.security.policyViolations24h')} />
          {stats.hostMemory !== undefined ? <StatCard title={AdminI18n.t('settings.security.hostMemory')} value={`${SecuritySettingsPageUtils.bytesToMB(stats.hostMemory?.rssBytes)} MB`}
            icon={<FrameworkIcons.Zap size={15} />} note={AdminI18n.t('settings.security.residentSetOfTheApi')} /> : null}
        </Columns>
        <Columns count={2} top>
          {this.settings ? <SecurityProtectionSummary settings={this.settings} onOpenSettings={this.onOpenSettings} /> : null}
          <div className="fc-columns__stack">
            {stats.sandbox !== undefined ? <SecurityProcessLimits processes={processes} /> : null}
            <SecuritySuspiciousActivity plugins={Array.isArray(stats.monitor?.suspiciousPlugins) ? stats.monitor.suspiciousPlugins : []} />
          </div>
        </Columns>
        <SecurityStoppedAddresses />
      </div>
    );
  }
}
