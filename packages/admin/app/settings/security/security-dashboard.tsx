import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import { SecuritySettingsPageUtils } from './security-settings-page-utils';
import { SecurityDefenseCards } from './security-defense-cards';
import type { SecurityDashboardProps } from './security-dashboard.interfaces';

export class SecurityDashboard extends React.Component<SecurityDashboardProps> {
  render(): React.ReactNode {
    const { stats } = this.props;
    const sandboxHeap = stats?.sandbox?.heap;
    const sandboxUsedMB = SecuritySettingsPageUtils.bytesToMB(sandboxHeap?.used_heap_size);
    const sandboxTotalMB = SecuritySettingsPageUtils.bytesToMB(sandboxHeap?.total_heap_size);
    const sandboxLimitMB = SecuritySettingsPageUtils.bytesToMB(sandboxHeap?.heap_size_limit);

    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        {!stats.sandbox && (
          <Card className="!bg-amber-500/5 !border-amber-500/20">
            <div className="flex items-start gap-4">
              <FrameworkIcons.Warning size={20} className="text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Sandbox Isolation Unavailable</h3>
                <p className="text-sm text-amber-800/70 dark:text-amber-400/70 leading-relaxed">
                  V8 isolated-vm sandbox is not active. Plugins are running in the main Node.js process without memory isolation.
                  Install <code className="px-1.5 py-0.5 bg-amber-900/10 dark:bg-amber-100/10 rounded text-xs font-mono">isolated-vm</code> to enable secure sandboxing.
                </p>
              </div>
            </div>
          </Card>
        )}
        {stats.sandbox && stats.sandbox.activeContexts === 0 && (
          <Card className="!bg-sky-500/5 !border-sky-500/20">
            <div className="flex items-start gap-4">
              <FrameworkIcons.Warning size={20} className="text-sky-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sky-900 dark:text-sky-300 mb-1">
                  {(stats.pluginIsolation?.sandboxActivePlugins ?? 0) > 0
                    ? 'Sandbox Runtime Not Attached Yet'
                    : 'No Active Sandboxed Plugins'}
                </h3>
                {(stats.pluginIsolation?.sandboxActivePlugins ?? 0) > 0 ? (
                  <p className="text-sm text-sky-800/70 dark:text-sky-400/70 leading-relaxed">
                    Sandbox policy is enabled for active plugins, but no isolate context is currently attached.
                    Runtime-sandbox active plugins: <strong>{stats.pluginIsolation?.sandboxRuntimeActivePlugins ?? 0}</strong>, policy-enabled active plugins: <strong>{stats.pluginIsolation?.sandboxActivePlugins ?? 0}</strong>.
                    {(stats.pluginIsolation?.sandboxPolicyRuntimeMismatchPlugins ?? 0) > 0 && (
                      <>
                        {' '}Mismatch: <strong>{(stats.pluginIsolation?.sandboxPolicyRuntimeMismatchSlugs || []).join(', ')}</strong>.
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-sky-800/70 dark:text-sky-400/70 leading-relaxed">
                    Sandbox runtime is available, but no active plugin currently has sandbox policy enabled.
                    {' '}Active plugins: <strong>{stats.pluginIsolation?.activePlugins ?? 0}</strong>, sandbox-policy active plugins: <strong>{stats.pluginIsolation?.sandboxActivePlugins ?? 0}</strong>.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className={`p-6 relative overflow-hidden ${!stats.sandbox ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">Sandbox Contexts</span>
              <FrameworkIcons.Box size={16} className={stats.sandbox ? 'text-indigo-500' : 'text-slate-400'} />
            </div>
            <div className="text-3xl font-bold">
              {stats.sandbox?.activeContexts ?? '-'}
            </div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">
              {stats.sandbox ? 'V8 Isolated Instances' : 'Sandbox Disabled'}
            </div>
          </Card>
          <Card className={`p-6 relative overflow-hidden ${!stats.sandbox ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wide text-slate-500">Memory Usage</span>
              <FrameworkIcons.Zap size={16} className={stats.sandbox ? 'text-amber-500' : 'text-slate-400'} />
            </div>
            <div className="text-3xl font-bold">
              {stats.sandbox?.heap ? `${sandboxUsedMB} MB` : '-'}
            </div>
            <div className="text-[10px] font-medium text-slate-400 mt-2 tracking-wide uppercase">
              {stats.sandbox ? 'Aggregate Sandbox Heap' : 'No Isolation Active'}
            </div>
            {stats.sandbox?.heap && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] text-slate-500">Used / Total heap: <strong>{sandboxUsedMB} / {sandboxTotalMB} MB</strong></div>
                <div className="text-[11px] text-slate-500">Isolate heap limit: <strong>{sandboxLimitMB} MB</strong></div>
              </div>
            )}
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

        <Card title="Sandbox Memory Scope">
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This value reports <strong>only isolated-vm sandbox heap memory</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20">
                <p className="text-[10px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-300 uppercase">Included</p>
                <p className="text-sm mt-2 text-emerald-900 dark:text-emerald-200">V8 isolate heap allocations for sandboxed plugin contexts.</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20">
                <p className="text-[10px] font-semibold tracking-wide text-amber-700 dark:text-amber-300 uppercase">Not Included</p>
                <ul className="mt-2 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                  <li>full Node process RSS</li>
                  <li>DB/network buffers</li>
                  <li>other non-isolate allocations</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {stats.pluginIsolation && (
          <Card title="Plugin Isolation Coverage">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Total Plugins</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.totalPlugins}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Active Plugins</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.activePlugins}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Sandbox Active</p>
                <p className="text-2xl font-bold mt-2">{stats.pluginIsolation.sandboxActivePlugins}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
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
