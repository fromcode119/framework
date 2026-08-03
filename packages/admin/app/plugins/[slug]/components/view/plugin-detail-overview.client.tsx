import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { PluginRegistryHealth, PluginState } from '@fromcode119/core/client';
import { VersionComparisonService } from '@/lib/version-comparison-service';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import { AdminClass } from '@/lib/admin-class';

export class PluginDetailOverview extends PureReactor {
  @prop declare loadingLogs: boolean;
  @prop declare logs: IPluginLogEntry[];
  @prop declare marketplaceItem: IPluginMarketplaceItem | null;
  @prop declare onRefreshLogs: () => void;
  @prop declare onToggle: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare theme: ThemeMode;

  /**
   * The plugin's activation state as a real enum member.
   *
   * `LoadedPluginHydration` resolves it at the fetch boundary, so this is normally already a member;
   * `resolve()` accepts either form so an un-hydrated row can never silently compare false.
   * NOT named `state` — React owns that member on a component.
   */
  private get runtimeState(): PluginState {
    return PluginState.resolve(this.plugin.state);
  }

  private get isActive(): boolean {
    return this.runtimeState === PluginState.ACTIVE;
  }

  private get isHeld(): boolean {
    return PluginRegistryHealth.resolve(this.plugin.healthStatus) === PluginRegistryHealth.WARNING
      || Boolean(this.plugin.heldReason);
  }

  render(): ReactNode {
    const hasUpdate = Boolean(this.marketplaceItem?.version && VersionComparisonService.isGreater(this.marketplaceItem.version, this.plugin.manifest.version));
    const isHeld = this.isHeld;
    const toggleLabel = isHeld ? 'Approve & enable' : this.isActive ? 'Active' : 'Disabled';

    return (
      <>
        <Card className={`border-0 relative overflow-hidden p-4 transition-all duration-300 ${AdminClass.SURFACE} ${this.theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          <div className="flex items-start gap-6">
            <div className={`h-16 w-16 rounded-xl flex items-center justify-center shadow-sm transition-transform ${this.theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'}`}>
              <FrameworkIcons.Plugins size={32} strokeWidth={1} />
            </div>
            <div className="flex-1 space-y-3">
              <Badge variant={BadgeVariant.BLUE} className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px] rounded-lg">
                {this.plugin.manifest.category || 'Core Plugin'}
              </Badge>
              <p className={`text-sm leading-relaxed font-medium ${this.theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}>
                {this.plugin.manifest.description || 'No description provided for this plugin.'}
              </p>
            </div>
          </div>

          {hasUpdate && this.marketplaceItem?.changelog && (
            <div className={`mt-6 p-4 rounded-xl border-2 border-dashed ${this.theme === ThemeMode.DARK ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100'}`}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-4 flex items-center gap-2">
                <FrameworkIcons.Zap size={14} /> New in v{this.marketplaceItem.version}
              </h4>
              <ul className="space-y-3">
                {this.marketplaceItem.changelog.map((item) => (
                  <li key={item} className="flex gap-3 text-sm font-medium text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`mt-6 pt-4 border-t ${this.theme === ThemeMode.DARK ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
            <div className="space-y-1">
              <div className={`text-[11px] font-semibold uppercase tracking-wider ${this.theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>Runtime Status</div>
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${this.isActive ? 'bg-green-500' : 'bg-slate-500'} shadow-[0_0_12px_rgba(34,197,94,0.3)]`} />
                <span className={`text-sm font-semibold uppercase tracking-tighter ${this.isActive ? 'text-green-500' : 'text-slate-500'}`}>{this.runtimeState.value}</span>
              </div>
            </div>
            <div className={`flex items-center gap-4 p-2.5 rounded-lg border transition-all duration-300 ${this.theme === ThemeMode.DARK ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100/80 border-slate-200/60 shadow-inner'}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isHeld ? 'text-amber-600 dark:text-amber-400' : this.theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-600'}`}>
                {toggleLabel}
              </span>
              <Switch checked={this.isActive} onChange={(_: boolean) => this.onToggle()} className="scale-110" />
            </div>
          </div>
        </Card>

        <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${this.theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${this.theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>Active Activity Logs</h3>
            <button onClick={this.onRefreshLogs} className={`h-9 px-4 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-2 border ${this.theme === ThemeMode.DARK ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-indigo-500 hover:text-indigo-600 shadow-sm hover:shadow-md'}`}>
              Refresh {this.loadingLogs ? <FrameworkIcons.Loader size={12} className="animate-spin" /> : <FrameworkIcons.Refresh size={12} />}
            </button>
          </div>
          <div className={`${AdminClass.SURFACE} ${this.theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'} overflow-hidden`}>
            <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar">
              {this.loadingLogs ? (
                <div className="p-6 text-center text-slate-500 font-semibold uppercase tracking-wider">Analyzing stream...</div>
              ) : this.logs.length > 0 ? (
                <table className="w-full border-collapse">
                  <tbody>
                    {this.logs.map((log) => (
                      <tr key={log.id || `${log.timestamp}-${log.message}`} className={`border-b last:border-0 transition-colors ${this.theme === ThemeMode.DARK ? 'border-slate-800/50 hover:bg-indigo-500/5' : 'border-slate-50 hover:bg-indigo-50/30'}`}>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap align-top font-bold">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold tracking-wider ${log.level === 'ERROR' ? 'bg-red-500 text-white' : log.level === 'WARN' ? 'bg-amber-500 text-white' : 'bg-indigo-500 text-white'}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-medium ${this.theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}>{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500 italic">Idle. No recent events recorded.</div>
              )}
            </div>
          </div>
        </Card>
      </>
    );
  }
}
