import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginHealthEntry } from '@/app/plugins/health/interfaces/plugin-health-entry.interface';
import { AdminClass } from '@/lib/admin-class';

/**
 * Plugins serving a different build than the one installed on disk, each with the action that fixes it.
 *
 * The health report has always counted them, and the dashboard said "restart to apply" — but this
 * screen listed none of them, and the restart was on another page. An isolated plugin does not need
 * the api restarted at all: its process is replaced on the installed code, the way a marketplace
 * update replaces it.
 */
export class PluginRestartPendingList extends PureReactor {
  declare props: Pick<PluginRestartPendingList, 'entries' | 'isBusy' | 'busySlug' | 'onLoadInstalled' | 'theme'>;

  @prop declare entries: IPluginHealthEntry[];
  @prop declare isBusy: boolean;
  @prop declare busySlug: string | null;
  @prop declare onLoadInstalled: (slug: string) => Promise<void>;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    if (!this.entries.length) return null;
    const isDark = this.theme === ThemeMode.DARK;
    return (
      <div className={`${AdminClass.SURFACE} overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
        {this.entries.map((entry) => (
          <div key={entry.slug} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isDark ? 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20' : 'bg-sky-50 text-sky-600 ring-1 ring-sky-100'}`}><FrameworkIcons.Refresh size={18} strokeWidth={1.5} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{entry.slug}</span>
                <Badge variant={BadgeVariant.INFO} className="shrink-0">Not the installed version</Badge>
              </div>
              <p className={`text-xs leading-snug truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Running {entry.runningVersion || 'unknown'}; installed {entry.installedVersion || 'unknown'}.
              </p>
            </div>
            <button onClick={() => this.onLoadInstalled(entry.slug)} disabled={this.isBusy} className="shrink-0 flex items-center gap-2 h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">
              {this.isBusy && this.busySlug === entry.slug ? <FrameworkIcons.Loader className="animate-spin" size={12} /> : <FrameworkIcons.Refresh size={12} />}
              <span>Load {entry.installedVersion || 'installed version'}</span>
            </button>
          </div>
        ))}
      </div>
    );
  }
}
