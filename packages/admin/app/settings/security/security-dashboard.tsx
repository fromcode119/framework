import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SecuritySettingsPageUtils } from '@/app/settings/security/security-settings-page-utils';
import { SecurityDefenseCards } from '@/app/settings/security/security-defense-cards';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class SecurityDashboard extends PureReactor {
  @prop declare stats: any;

  render(): ReactNode {
    const stats = this.stats;
    // `sandbox` is the list of plugin PROCESSES. It used to be a V8 isolate's heap statistics, and this
    // screen still read `activeContexts` and `heap` from it long after isolates were replaced by real
    // processes — so two of its three headline cards could only ever print "-", and a panel explained
    // the memory accounting of a mechanism that no longer exists.
    const processes: any[] = Array.isArray(stats?.sandbox?.processes) ? stats.sandbox.processes : [];
    const hostRssMB = SecuritySettingsPageUtils.bytesToMB(stats?.hostMemory?.rssBytes);
    // WITHHELD is not ZERO. In a site scope the API omits `sandbox` and `hostMemory` outright — they
    // describe the shared container, and a process table is not divisible by site. Rendering them
    // anyway printed "Plugin Processes 0" and "No plugin is running in its own process right now"
    // beside "Sandbox active 2", which is not a gap in the data but a contradiction of it, and
    // "- MB" under a heading promising the api process's resident set. Same call this screen already
    // made when isolates were replaced by processes: a card that cannot carry a real value is not
    // shown at all.
    const processesKnown = stats?.sandbox !== undefined;
    const hostMemoryKnown = stats?.hostMemory !== undefined;

    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {processesKnown ? (
            <Card className="p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wide text-slate-500">{AdminI18n.t('settings.security.pluginProcesses')}</span>
                <FrameworkIcons.Box size={16} className="text-indigo-500" />
              </div>
              <div className="text-3xl font-bold">{processes.length}</div>
              <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">{AdminI18n.t('settings.security.runningUnderTheirOwnIdentity')}</div>
            </Card>
          ) : null}
          {hostMemoryKnown ? (
            <Card className="p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wide text-slate-500">{AdminI18n.t('settings.security.hostMemory')}</span>
                <FrameworkIcons.Zap size={16} className="text-amber-500" />
              </div>
              <div className="text-3xl font-bold">{hostRssMB} MB</div>
              <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">{AdminI18n.t('settings.security.residentSetOfTheApi')}</div>
              <div className="mt-3 text-[11px] text-slate-500">
                {AdminI18n.t('settings.security.pluginProcessesAreSeparateEach')}
              </div>
            </Card>
          ) : null}
          <Card className="p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">{AdminI18n.t('settings.security.threatAlerts')}</span>
              <FrameworkIcons.ShieldAlert size={16} className={stats.monitor?.violations24h > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
            <div className={`text-3xl font-bold ${stats.monitor?.violations24h > 0 ? 'text-red-500' : ''}`}>
              {stats.monitor?.violations24h || 0}
            </div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">{AdminI18n.t('settings.security.policyViolations24h')}</div>
          </Card>
        </div>

        {processesKnown ? (
        <Card title={AdminI18n.t('settings.security.pluginProcesses')}>
          <div className="pt-2">
            {processes.length === 0 ? (
              <p className="text-sm text-slate-500">{AdminI18n.t('settings.security.noPluginIsRunningIn')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">{AdminI18n.t('settings.security.plugin')}</th>
                      <th className="py-2 pr-4">PID</th>
                      <th className="py-2 pr-4">{AdminI18n.t('settings.security.memoryLimit')}</th>
                      <th className="py-2">{AdminI18n.t('settings.security.callTimeout')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((entry: any) => (
                      <tr key={String(entry.slug)} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 font-semibold text-slate-900 dark:text-slate-200">{entry.slug}</td>
                        <td className="py-2 pr-4 text-slate-500">{entry.pid ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-500">{entry.memoryMb} MB</td>
                        <td className="py-2 text-slate-500">{entry.timeoutMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
        ) : null}

        {stats.pluginIsolation && (
          <Card title={AdminI18n.t('settings.security.pluginIsolationCoverage')}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{AdminI18n.t('settings.security.totalPlugins')}</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.totalPlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{AdminI18n.t('settings.security.activePlugins')}</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.activePlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{AdminI18n.t('settings.security.sandboxActive')}</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxActivePlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{AdminI18n.t('settings.security.sandboxRuntime')}</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxRuntimeActivePlugins ?? 0}</p>
              </div>
            </div>
          </Card>
        )}

        <SecurityDefenseCards stats={stats} />
      </div>
    );
  }
}
