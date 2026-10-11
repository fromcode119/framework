import type { ComponentType, ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SecuritySettingsPageUtils } from '@/app/settings/security/security-settings-page-utils';
import { SecurityProtectionSummary } from '@/app/settings/security/security-protection-summary';
import { SecurityProcessLimits } from '@/app/settings/security/security-process-limits';
import { SecuritySuspiciousActivity } from '@/app/settings/security/security-suspicious-activity';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Security → Dashboard: what protects the platform (from the saved settings), how its plugins are held
 * apart (from the running processes), and what the monitor recorded. In a site scope the API withholds
 * the process list and host memory — they describe the shared box — and those cards are not shown.
 */
export class SecurityDashboard extends PureReactor {
  declare props: Pick<SecurityDashboard, 'stats' | 'settings' | 'onOpenSettings'>;

  @prop declare stats: any;
  @prop declare settings: Record<string, string> | null;
  @prop declare onOpenSettings: () => void;

  private stat(icon: ComponentType<{ size?: number; className?: string }>, label: string, value: ReactNode, note: string, tone = 'text-indigo-500'): ReactNode {
    const Icon = icon;
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500">{label}</span>
          <Icon size={16} className={tone} />
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-[12px] text-slate-500 mt-2">{note}</div>
      </Card>
    );
  }

  render(): ReactNode {
    const stats = this.stats ?? {};
    const processes: any[] = Array.isArray(stats.sandbox?.processes) ? stats.sandbox.processes : [];
    const isolation = stats.pluginIsolation;
    const violations = Number(stats.monitor?.violations24h || 0);
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isolation ? this.stat(FrameworkIcons.Box, AdminI18n.t('settings.security.isolatedTitle'),
            `${isolation.sandboxActivePlugins} / ${isolation.activePlugins}`, AdminI18n.t('settings.security.isolatedNote')) : null}
          {this.stat(FrameworkIcons.ShieldAlert, AdminI18n.t('settings.security.threatAlerts'), violations,
            AdminI18n.t('settings.security.policyViolations24h'), violations > 0 ? 'text-red-500' : 'text-green-500')}
          {stats.hostMemory !== undefined ? this.stat(FrameworkIcons.Zap, AdminI18n.t('settings.security.hostMemory'),
            `${SecuritySettingsPageUtils.bytesToMB(stats.hostMemory?.rssBytes)} MB`, AdminI18n.t('settings.security.residentSetOfTheApi'), 'text-amber-500') : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {this.settings ? <SecurityProtectionSummary settings={this.settings} onOpenSettings={this.onOpenSettings} /> : null}
          <div className="space-y-6">
            {stats.sandbox !== undefined ? <SecurityProcessLimits processes={processes} /> : null}
            <SecuritySuspiciousActivity plugins={Array.isArray(stats.monitor?.suspiciousPlugins) ? stats.monitor.suspiciousPlugins : []} />
          </div>
        </div>
      </div>
    );
  }
}
