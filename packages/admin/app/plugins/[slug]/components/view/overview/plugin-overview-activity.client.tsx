import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import { DetailBox } from '@/components/view/detail-box.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The plugin's recent log lines across every site — the platform's view, so only in Platform scope. */
export class PluginOverviewActivity extends PureReactor {
  @prop declare loading: boolean;
  @prop declare logs: IPluginLogEntry[];
  @prop declare onRefresh: () => void;
  @prop declare theme: ThemeMode;

  private level(level: string): string {
    if (level === 'ERROR') return 'bg-rose-500/15 text-rose-500';
    if (level === 'WARN') return 'bg-amber-500/15 text-amber-500';
    return 'bg-indigo-500/15 text-indigo-400';
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const refresh = (
      <button type="button" onClick={this.onRefresh} aria-label={AdminI18n.t('plugins.detail.refresh')}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white'}`}>
        {this.loading ? <FrameworkIcons.Loader size={13} className="animate-spin" /> : <FrameworkIcons.Refresh size={13} />}
      </button>
    );
    return (
      <DetailBox title={AdminI18n.t('plugins.detail.recentActivity')} theme={this.theme} action={refresh}>
        {this.logs.length ? (
          <div className="max-h-[260px] overflow-y-auto">
            {this.logs.map((log) => (
              <div key={log.id || `${log.timestamp}-${log.message}`} className={`flex items-start gap-3 border-t py-2 text-[13px] first:border-t-0 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
                <time className={`w-20 shrink-0 tabular-nums ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(log.timestamp).toLocaleTimeString(AdminI18n.locale)}</time>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${this.level(log.level)}`}>{log.level}</span>
                <span className={`min-w-0 break-words ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{log.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={`py-2 text-[13px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{this.loading ? AdminI18n.t('plugins.detail.analyzingStream') : AdminI18n.t('plugins.detail.idleNoRecentEventsRecorded')}</p>
        )}
      </DetailBox>
    );
  }
}
