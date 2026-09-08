import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SecuritySettingsPageUtils } from '@/app/settings/security/security-settings-page-utils';
import { SecurityDefenseCards } from '@/app/settings/security/security-defense-cards';
import { AdminClass } from '@/lib/admin-class';

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

    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">Plugin Processes</span>
              <FrameworkIcons.Box size={16} className="text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{processes.length}</div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">Running under their own identity</div>
          </Card>
          <Card className="p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">Host Memory</span>
              <FrameworkIcons.Zap size={16} className="text-amber-500" />
            </div>
            <div className="text-3xl font-bold">{hostRssMB} MB</div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">Resident set of the api process</div>
            <div className="mt-3 text-[11px] text-slate-500">
              Plugin processes are separate: each carries its own limit, listed below.
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">Threat Alerts</span>
              <FrameworkIcons.ShieldAlert size={16} className={stats.monitor?.violations24h > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
            <div className={`text-3xl font-bold ${stats.monitor?.violations24h > 0 ? 'text-red-500' : ''}`}>
              {stats.monitor?.violations24h || 0}
            </div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">Policy Violations (24h)</div>
          </Card>
        </div>

        <Card title="Plugin Processes">
          <div className="pt-2">
            {processes.length === 0 ? (
              <p className="text-sm text-slate-500">No plugin is running in its own process right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Plugin</th>
                      <th className="py-2 pr-4">PID</th>
                      <th className="py-2 pr-4">Memory limit</th>
                      <th className="py-2">Call timeout</th>
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

        {stats.pluginIsolation && (
          <Card title="Plugin Isolation Coverage">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Total Plugins</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.totalPlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Active Plugins</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.activePlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Sandbox Active</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxActivePlugins}</p>
              </div>
              <div className={`p-4 ${AdminClass.SURFACE} bg-slate-50 dark:bg-slate-900/50`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Sandbox Runtime</p>
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
