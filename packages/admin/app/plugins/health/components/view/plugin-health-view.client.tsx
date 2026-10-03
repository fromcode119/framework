import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginHeldLabel } from '@/components/plugins/plugin-held-label';
import type { IPluginHealthEntry } from '@/app/plugins/health/interfaces/plugin-health-entry.interface';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';
import { AdminClass } from '@/lib/admin-class';
import { PluginRestartPendingList } from '@/app/plugins/health/components/view/plugin-restart-pending-list.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginHealthView extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<PluginHealthView, 'loading' | 'report' | 'isBusy' | 'busySlug' | 'onApproveEnable' | 'onReapproveAll' | 'onLoadInstalled' | 'theme'>;

  @prop declare loading: boolean;
  @prop declare report: IPluginHealthReport | null;
  @prop declare isBusy: boolean;
  @prop declare busySlug: string | null;
  @prop declare onApproveEnable: (slug: string) => Promise<void>;
  @prop declare onReapproveAll: () => Promise<void>;
  @prop declare onLoadInstalled: (slug: string) => Promise<void>;
  @prop declare theme: ThemeMode;

  private drift(entry: IPluginHealthEntry): string {
    return [
      ...(entry.addedCapabilities || []).map((c) => `+${c}`),
      ...(entry.removedCapabilities || []).map((c) => `-${c}`),
    ].join(' ');
  }

  render(): ReactNode {
    const isDark = this.theme === ThemeMode.DARK;

    if (this.loading) {
      return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label={AdminI18n.t('plugins.list.loadingPlatformHealth')} /></div>;
    }
    if (!this.report) {
      return (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4"><FrameworkIcons.Activity size={32} className="text-slate-300 dark:text-slate-700" /></div>
          <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('plugins.list.healthReportUnavailable')}</h3>
          <p className="text-slate-500 font-medium">{AdminI18n.t('plugins.list.couldNotLoadThePlatform')}</p>
        </div>
      );
    }

    const counts = this.report.counts;
    const summaryStats: Array<{ label: string; value: number; tone: string }> = [
      { label: AdminI18n.t('plugins.list.total'), value: counts.total, tone: isDark ? 'text-white' : 'text-slate-900' },
      { label: AdminI18n.t('plugins.list.active'), value: counts.active, tone: 'text-emerald-500' },
      { label: AdminI18n.t('plugins.list.held'), value: counts.held, tone: counts.held > 0 ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-500') },
      { label: AdminI18n.t('plugins.list.errors'), value: counts.error, tone: counts.error > 0 ? 'text-rose-500' : (isDark ? 'text-slate-400' : 'text-slate-500') },
      { label: AdminI18n.t('plugins.list.inactive'), value: counts.inactive, tone: isDark ? 'text-slate-400' : 'text-slate-500' },
    ];
    // A plugin serving an older build than the one installed counts: the report says "attention needed"
    // for it, and this screen used to answer "everything looks healthy" beside that badge.
    const needsAttention = counts.held > 0 || counts.error > 0 || counts.restartPending > 0;

    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center gap-2">
          {summaryStats.map((s) => (
            <div key={s.label} className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
              <span className={`text-sm font-bold tabular-nums ${s.tone}`}>{s.value}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</span>
            </div>
          ))}
          <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${this.report.ok ? (isDark ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDark ? 'border-rose-500/20 bg-rose-500/10' : 'border-rose-200 bg-rose-50')}`}>
            {this.report.ok ? <FrameworkIcons.CheckCircle size={13} className="text-emerald-500" /> : <FrameworkIcons.Alert size={13} className="text-rose-500" />}
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${this.report.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{this.report.ok ? AdminI18n.t('plugins.list.allHealthy') : AdminI18n.t('plugins.list.attentionNeeded')}</span>
          </div>
        </div>

        {counts.held > 0 ? (
          <div className={`rounded-xl border px-4 py-3 ${isDark ? 'border-amber-500/20 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-white text-amber-500 shadow-sm'}`}><FrameworkIcons.Alert size={18} /></div>
              <div className="flex-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">{AdminI18n.t('plugins.list.capabilityChangeDetected')}</h3>
                <p className={`mt-1 text-sm font-medium leading-relaxed ${isDark ? 'text-amber-100/90' : 'text-amber-700'}`}>
                  {AdminI18n.t(counts.held === 1 ? 'plugins.list.heldOne' : 'plugins.list.heldMany', { count: counts.held })}
                </p>
              </div>
              <button onClick={this.onReapproveAll} disabled={this.isBusy} className="shrink-0 flex items-center gap-2 h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">
                {this.isBusy ? <FrameworkIcons.Loader className="animate-spin" size={14} /> : <FrameworkIcons.Shield size={14} />}
                <span>{AdminI18n.t('plugins.list.reApproveAllHeld')}</span>
              </button>
            </div>
          </div>
        ) : null}

        {needsAttention ? (
          <div className="space-y-3">
            <h2 className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{AdminI18n.t('plugins.list.needsAttention')}</h2>

            {this.report.held.length > 0 ? (
              <div className={`${AdminClass.SURFACE} overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
                {this.report.held.map((entry) => {
                  const drift = this.drift(entry);
                  // `entry` is API JSON, so `heldReason` is a raw string here — resolve before comparing.
                  const heldLabel = PluginHeldLabel.of(entry.heldReason);
                  return (
                    <div key={entry.slug} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'}`}><FrameworkIcons.Shield size={18} strokeWidth={1.5} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{entry.slug}</span>
                          <Badge variant={BadgeVariant.AMBER} className="shrink-0 flex items-center gap-1"><FrameworkIcons.Zap size={9} />{heldLabel}</Badge>
                          {drift ? <span title={AdminI18n.t('plugins.list.capabilityChangeSinceApproval', { drift: drift })} className="shrink-0 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">{drift}</span> : null}
                        </div>
                        <p className={`text-xs leading-snug truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{AdminI18n.t('plugins.list.heldPendingReApprovalOf')}</p>
                      </div>
                      <button onClick={() => this.onApproveEnable(entry.slug)} disabled={this.isBusy} className="shrink-0 flex items-center gap-2 h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[10px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">
                        {this.isBusy && this.busySlug === entry.slug ? <FrameworkIcons.Loader className="animate-spin" size={12} /> : <FrameworkIcons.Shield size={12} />}
                        <span>{AdminI18n.t('plugins.list.approveEnable')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <PluginRestartPendingList
              entries={this.report.restartPending || []}
              isBusy={this.isBusy}
              busySlug={this.busySlug}
              onLoadInstalled={this.onLoadInstalled}
              theme={this.theme}
            />

            {this.report.error.length > 0 ? (
              <div className={`${AdminClass.SURFACE} overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
                {this.report.error.map((entry) => (
                  <div key={entry.slug} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                    <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'}`}><FrameworkIcons.Alert size={18} strokeWidth={1.5} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{entry.slug}</span>
                        <Badge variant={BadgeVariant.DANGER} className="shrink-0 flex items-center gap-1"><FrameworkIcons.Zap size={9} />{AdminI18n.t('plugins.list.error')}</Badge>
                      </div>
                      <p className="text-xs leading-snug truncate text-rose-500 font-medium">{entry.error || AdminI18n.t('plugins.list.pluginFailedToInitialize')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><FrameworkIcons.CheckCircle size={32} className="text-emerald-500" /></div>
            <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('plugins.list.everythingLooksHealthy')}</h3>
            <p className="text-slate-500 font-medium">{AdminI18n.t('plugins.list.noHeldCapabilityChangesNo')}</p>
          </div>
        )}
      </div>
    );
  }
}
