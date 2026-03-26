"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FrameworkIcons } from '@/lib/icons';
import type { PluginDetailOverviewProps } from '../plugin-detail-page.interfaces';

export default function PluginDetailOverview({
  loadingLogs,
  logs,
  marketplaceItem,
  onRefreshLogs,
  onToggle,
  plugin,
  theme,
}: PluginDetailOverviewProps) {
  const hasUpdate = marketplaceItem?.version && marketplaceItem.version !== plugin.manifest.version;

  return (
    <>
      <Card className={`border-0 relative overflow-hidden p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex items-start gap-8">
          <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
            <FrameworkIcons.Plugins size={48} strokeWidth={1} />
          </div>
          <div className="flex-1 space-y-4">
            <Badge variant="blue" className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px] rounded-lg">
              {plugin.manifest.category || 'Core Plugin'}
            </Badge>
            <p className={`text-xl leading-relaxed font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {plugin.manifest.description || 'No description provided for this plugin.'}
            </p>
          </div>
        </div>

        {hasUpdate && marketplaceItem?.changelog && (
          <div className={`mt-10 p-6 rounded-3xl border-2 border-dashed ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100'}`}>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-4 flex items-center gap-2">
              <FrameworkIcons.Zap size={14} /> New in v{marketplaceItem.version}
            </h4>
            <ul className="space-y-3">
              {marketplaceItem.changelog.map((item) => (
                <li key={item} className="flex gap-3 text-sm font-medium text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
          <div className="space-y-1">
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Runtime Status</div>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${plugin.state === 'active' ? 'bg-green-500' : 'bg-slate-500'} shadow-[0_0_12px_rgba(34,197,94,0.3)]`} />
              <span className={`text-sm font-semibold uppercase tracking-tighter ${plugin.state === 'active' ? 'text-green-500' : 'text-slate-500'}`}>{plugin.state}</span>
            </div>
          </div>
          <div className={`flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-inner'}`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {plugin.state === 'active' ? 'Active' : 'Disabled'}
            </span>
            <Switch checked={plugin.state === 'active'} onChange={(_: boolean) => onToggle()} className="scale-110" />
          </div>
        </div>
      </Card>

      <Card className={`border-0 p-8 ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex items-center justify-between mb-8">
          <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Active Activity Logs</h3>
          <button onClick={onRefreshLogs} className={`h-10 px-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-2 border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-indigo-500 hover:text-indigo-600 shadow-sm hover:shadow-md'}`}>
            Refresh {loadingLogs ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Refresh size={12} />}
          </button>
        </div>
        <div className={`rounded-2xl border-2 transition-all duration-300 ${theme === 'dark' ? 'border-slate-800/50 bg-slate-950/40' : 'border-slate-100 bg-white shadow-inner shadow-slate-200/20'} overflow-hidden`}>
          <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar">
            {loadingLogs ? (
              <div className="p-10 text-center text-slate-500 font-semibold uppercase tracking-wider">Analyzing stream...</div>
            ) : logs.length > 0 ? (
              <table className="w-full border-collapse">
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id || `${log.timestamp}-${log.message}`} className={`border-b last:border-0 transition-colors ${theme === 'dark' ? 'border-slate-800/50 hover:bg-indigo-500/5' : 'border-slate-50 hover:bg-indigo-50/30'}`}>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap align-top font-bold">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wider ${log.level === 'ERROR' ? 'bg-red-500 text-white' : log.level === 'WARN' ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white'}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-10 text-center text-slate-500 italic">Idle. No recent events recorded.</div>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
